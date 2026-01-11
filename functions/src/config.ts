import * as fs from "fs";
import * as path from "path";

/**
 * Read .firebaserc and extract project IDs by alias.
 * @returns Map of alias -> project ID
 */
function readFirebasercProjects(): Map<string, string> {
  const projects = new Map<string, string>();

  try {
    const firebasercPath = path.join(__dirname, "../../.firebaserc");
    if (fs.existsSync(firebasercPath)) {
      const firebasercContent = fs.readFileSync(firebasercPath, "utf-8");
      const firebaserc = JSON.parse(firebasercContent);
      
      if (firebaserc.projects) {
        for (const [alias, projectId] of Object.entries(firebaserc.projects)) {
          if (typeof projectId === "string") {
            projects.set(alias.toLowerCase(), projectId);
          }
        }
      }
    }
  } catch (error) {
    // If we can't read .firebaserc, return empty map
  }

  return projects;
}

/**
 * Get allowed (dev/stage) project IDs from .firebaserc.
 * Projects with aliases "dev" or "stage" are allowed.
 * 
 * @returns Array of allowed project IDs
 */
export function getAllowedProjectIds(): string[] {
  const allowedProjects: string[] = [];
  const projects = readFirebasercProjects();

  // Extract projects marked as "dev" or "stage"
  for (const [alias, projectId] of projects.entries()) {
    if (alias === "dev" || alias === "stage") {
      if (!allowedProjects.includes(projectId)) {
        allowedProjects.push(projectId);
      }
    }
  }

  return allowedProjects;
}

/**
 * Get production project IDs from .firebaserc.
 * Projects with alias "prod" are considered production.
 * 
 * @returns Array of production project IDs
 */
export function getProductionProjectIds(): string[] {
  const productionProjects: string[] = [];
  const projects = readFirebasercProjects();

  // Extract projects marked as "prod"
  for (const [alias, projectId] of projects.entries()) {
    if (alias === "prod") {
      if (!productionProjects.includes(projectId)) {
        productionProjects.push(projectId);
      }
    }
  }

  return productionProjects;
}

/**
 * Get default project ID from .firebaserc.
 * Prefers "dev" project, then "stage" project, then first allowed project.
 * 
 * @returns Default project ID, or undefined if none found
 */
export function getDefaultProjectId(): string | undefined {
  const projects = readFirebasercProjects();

  // Prefer "dev" project
  if (projects.has("dev")) {
    return projects.get("dev");
  }

  // Fallback to "stage" project
  if (projects.has("stage")) {
    return projects.get("stage");
  }

  // Fallback to first allowed project (dev or stage)
  const allowedProjects = getAllowedProjectIds();
  if (allowedProjects.length > 0) {
    return allowedProjects[0];
  }

  return undefined;
}
