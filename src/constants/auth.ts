/**
 * Firebase Data Connect Auth Expressions
 * 
 * These constants define the auth expressions used in GraphQL queries and mutations.
 * They should match the expressions in dataconnect/api/*.gql files.
 * 
 * Note: GraphQL files cannot directly import TypeScript constants, but these
 * serve as documentation and can be used for validation.
 */

export const AUTH_EXPRESSIONS = {
  /**
   * User access - requires enabled claim
   * Expression: "auth.token.enabled == true"
   */
  USER_ACCESS: "auth.token.enabled == true",
  
  /**
   * Admin access - requires both admin and enabled claims
   * Expression: "auth.token.admin == true && auth.token.enabled == true"
   */
  ADMIN_ACCESS: "auth.token.admin == true && auth.token.enabled == true",
  
  /**
   * No access - for system-level operations (Firebase Functions)
   * Expression: @auth(level: NO_ACCESS)
   */
  NO_ACCESS: "NO_ACCESS",
} as const;

/**
 * Auth expression type
 */
export type AuthExpression = typeof AUTH_EXPRESSIONS[keyof typeof AUTH_EXPRESSIONS];

