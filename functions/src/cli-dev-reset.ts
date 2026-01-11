#!/usr/bin/env node
/**
 * CLI script to call devResetAndSeed function.
 * 
 * Authentication:
 *   This script uses Firebase Admin SDK which requires Application Default Credentials (ADC).
 *   
 *   NOTE: `firebase login` will NOT work for this script. You need Google Cloud credentials.
 *   
 *   You have three options:
 * 
 *   1. Use gcloud CLI (recommended for local dev, similar to firebase login):
 *      gcloud auth application-default login
 *      (This is the Google Cloud equivalent of firebase login)
 * 
 *   2. Use service account key file:
 *      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
 * 
 *   3. Use Firebase emulator (if running locally):
 *      The emulator will automatically provide credentials
 * 
 * Project ID Detection:
 *   The script detects the project ID from:
 *   1. GCLOUD_PROJECT environment variable (if set)
 *   2. .firebaserc file (uses "dev" project, or "stage" if no dev)
 * 
 *   No environment variables needed if .firebaserc exists with a "dev" or "stage" project!
 * 
 * Safety Features:
 *   - Uses .firebaserc as the source of truth for project configuration
 *   - Automatically allows projects marked as "dev" or "stage" in .firebaserc
 *   - Automatically blocks projects marked as "prod" in .firebaserc
 *   - Blocks unknown projects (not in .firebaserc)
 *   - Requires explicit confirmation before destructive operations
 *   - Shows project ID and detection source before proceeding
 * 
 * Usage:
 *   npm run dev-reset -- admin@example.com
 *   or
 *   node lib/cli-dev-reset.js admin@example.com
 */

import * as admin from "firebase-admin";
import * as readline from "readline";
import {
  listUsers as dcListUsers,
  deleteUser as dcDeleteUser,
  createUser,
  MembershipStatus,
} from "@dataconnect/admin-generated";
import { getAllowedProjectIds, getProductionProjectIds, getDefaultProjectId } from "./config";

const DEFAULT_PASSWORD = "password";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Get the current Firebase project ID for local execution.
 * Tries: GCLOUD_PROJECT env var, then .firebaserc (dev project)
 */
function getProjectId(): string | undefined {
  // Try GCLOUD_PROJECT environment variable first
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }

  // Fallback to .firebaserc (prefer dev, then stage)
  return getDefaultProjectId();
}

/**
 * Validate project safety before proceeding.
 * Uses .firebaserc as the source of truth:
 * - Blocks if project is marked as "prod"
 * - Allows if project is marked as "dev" or "stage"
 * - Blocks otherwise (unknown projects)
 */
function requireEnvAllowed(projectId: string): void {
  // Check if this is a production project
  const productionProjects = getProductionProjectIds();
  if (productionProjects.includes(projectId)) {
    console.error("\n" + "=".repeat(70));
    console.error("🚨 PRODUCTION PROJECT DETECTED - SCRIPT BLOCKED FOR SAFETY 🚨");
    console.error("=".repeat(70));
    console.error(`\nDetected project ID: "${projectId}"`);
    console.error(`\nThis project is marked as PRODUCTION in .firebaserc and cannot be reset.`);
    console.error(`\nProduction projects detected:`);
    productionProjects.forEach((prodId) => {
      console.error(`  - ${prodId}`);
    });
    console.error(`\nIf you believe this is an error, check your .firebaserc file.`);
    console.error("\n" + "=".repeat(70));
    throw new Error("Production project detected - script execution blocked");
  }

  // Check if project is in allowed list (dev/stage)
  const allowedProjects = getAllowedProjectIds();
  if (!allowedProjects.includes(projectId)) {
    const projectInfo = `"${projectId}"`;
    const allowedInfo = allowedProjects.length > 0 
      ? `[${allowedProjects.join(", ")}]` 
      : "none";
    throw new Error(
      `Project ${projectInfo} is not allowed.\n` +
      `\nAllowed projects (from .firebaserc with "dev" or "stage" alias): ${allowedInfo}\n` +
      `Production projects (blocked): [${productionProjects.join(", ")}]\n` +
      `\nTo allow this project, add it to .firebaserc with a "dev" or "stage" alias.`
    );
  }
}

/**
 * Prompt user for confirmation before proceeding with destructive operations.
 */
function confirmBeforeProceeding(projectId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n" + "=".repeat(70));
    console.log("⚠️  DESTRUCTIVE OPERATION WARNING ⚠️");
    console.log("=".repeat(70));
    console.log(`\nThis script will:`);
    console.log(`  • DELETE ALL Firebase Auth users`);
    console.log(`  • DELETE ALL DataConnect user rows`);
    console.log(`  • CREATE a new admin user with profile`);
    console.log(`\nTarget Project: ${projectId}`);
    console.log("\n" + "=".repeat(70));
    console.log("\n⚠️  THIS CANNOT BE UNDONE ⚠️\n");

    rl.question(
      `Type "yes" to confirm and proceed: `,
      (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        resolve(trimmed === "yes");
      }
    );
  });
}

function validateEmail(input: unknown): string {
  if (typeof input !== "string" || !EMAIL_REGEX.test(input.trim())) {
    throw new Error("A valid email is required");
  }
  return input.trim();
}

/**
 * Delete all users from Firebase Auth.
 */
async function deleteAllAuthUsers(): Promise<void> {
  let totalDeleted = 0;
  let nextPageToken: string | undefined;
  
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    const uids = result.users.map((u) => u.uid);
    
    if (uids.length > 0) {
      await admin.auth().deleteUsers(uids);
      totalDeleted += uids.length;
      console.log(`Deleted ${uids.length} auth users (total: ${totalDeleted})`);
    }
    
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  
  if (totalDeleted === 0) {
    console.log("No auth users to delete");
  } else {
    console.log(`✅ Deleted all ${totalDeleted} Firebase Auth users`);
  }
}

/**
 * Delete all users from DataConnect.
 */
async function deleteAllDataConnectUsers(): Promise<void> {
  try {
    const result = await dcListUsers();
    const users = result.data?.users ?? [];
    
    if (!users.length) {
      console.log("No DataConnect users to delete");
      return;
    }

    let totalDeleted = 0;
    for (const user of users) {
      try {
        await dcDeleteUser({ userId: user.id });
        totalDeleted++;
      } catch (error) {
        console.warn(`Failed to delete DataConnect user ${user.id}:`, error);
      }
    }

    if (totalDeleted > 0) {
      console.log(`✅ Deleted ${totalDeleted} DataConnect user rows`);
    }
  } catch (error) {
    console.warn("Failed to delete DataConnect users (continuing):", error);
  }
}

function generateServiceNumber(): string {
  return `DEV-${Date.now()}`;
}

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Usage: npm run dev-reset -- <email>");
    console.error("Example: npm run dev-reset -- admin@example.com");
    console.error("\nProject Configuration:");
    console.error("  - Projects are automatically detected from .firebaserc");
    console.error("  - Projects with 'dev' or 'stage' alias are allowed");
    console.error("  - Projects with 'prod' alias are blocked");
    console.error("  - Project ID is auto-detected from .firebaserc (or GCLOUD_PROJECT env var)");
    console.error("\nOptional environment variable:");
    console.error("  - GCLOUD_PROJECT=your-project-id (if .firebaserc is not available)");
    console.error("\nExample:");
    console.error('  npm run dev-reset -- admin@example.com');
    process.exit(1);
  }

  try {
    // Get project ID (from env var or .firebaserc)
    const projectId = getProjectId();
    if (!projectId) {
      console.error("\n❌ Project ID Error:");
      console.error("Could not determine Firebase project ID.");
      console.error("\nSet it with one of the following:");
      console.error("  1. export GCLOUD_PROJECT=your-project-id");
      console.error("  2. Add a 'dev' or 'stage' project to .firebaserc");
      process.exit(1);
    }

    // Initialize Firebase Admin with explicit project ID
    // Uses Application Default Credentials (ADC) from gcloud auth
    if (!admin.apps.length) {
      try {
        admin.initializeApp({
          projectId,
        });
      } catch (error: any) {
        if (error?.code === "app/no-app" || error?.message?.includes("credential")) {
          console.error("\n❌ Authentication Error:");
          console.error("Firebase Admin SDK requires Google Cloud authentication.");
          console.error("\nRun: gcloud auth application-default login");
          console.error("\nFor more info: https://cloud.google.com/docs/authentication/application-default-credentials");
          process.exit(1);
        }
        throw error;
      }
    }

    console.log(`\nProject ID: ${projectId}`);

    // Validate project safety (check for production and permitted list)
    requireEnvAllowed(projectId);

    const validatedEmail = validateEmail(email);

    // Require explicit confirmation before proceeding
    const confirmed = await confirmBeforeProceeding(projectId);
    if (!confirmed) {
      console.error("\n❌ Operation cancelled by user.");
      process.exit(1);
    }

    console.log("\nStarting dev reset and seed...\n");

    // Step 1: Delete all Firebase Auth users
    console.log("Step 1: Deleting all Firebase Auth users...");
    await deleteAllAuthUsers();

    // Step 2: Delete all DataConnect user rows
    console.log("\nStep 2: Deleting all DataConnect user rows...");
    await deleteAllDataConnectUsers();

    // Step 3: Create new admin user
    console.log("\nStep 3: Creating new admin user...");
    const userRecord = await admin.auth().createUser({
      email: validatedEmail,
      password: DEFAULT_PASSWORD,
      emailVerified: true,
      displayName: "Admin, Dev",
    });

    console.log(userRecord);

    // Step 4: Set admin claims
    console.log("Step 4: Setting admin claims...");
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true,
      enabled: true,
    });

    // Step 5: Create user profile in DataConnect
    console.log("Step 5: Creating user profile in DataConnect...");
    
    const serviceNumber = generateServiceNumber();
    const mutationVars = {
      userId: userRecord.uid,
      firstName: "Dev",
      lastName: "Admin",
      email: validatedEmail,
      serviceNumber: serviceNumber,
      membershipStatus: MembershipStatus.REGULAR,
      isRegular: false,
      isReserve: false,
      isCivilServant: false,
      isIndustry: false,
      now: new Date().toISOString()
    };
    
    try {
      console.log('\n🔄 Creating user profile...');
      await createUser(mutationVars);
      console.log('✅ User created successfully');
    } catch (error: any) {
      console.error('\n❌ Error creating user profile:', error?.message);
      throw error;
    }

    console.log(`\n✅ Successfully seeded dev admin user:`);
    console.log(`   Email: ${validatedEmail}`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
  } catch (error: any) {
    // Handle production blocking errors with special formatting
    if (error?.message?.includes("Production project detected")) {
      // Error already displayed with full formatting in requireEnvAllowed
      process.exit(1);
    }

    // Handle other errors
    console.error("\n❌ Error occurred:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack && process.env.DEBUG) {
        console.error("\nStack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    
    process.exit(1);
  }
}

main();
