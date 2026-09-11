/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as expenseMembers from "../expenseMembers.js";
import type * as expenses from "../expenses.js";
import type * as http from "../http.js";
import type * as imageFormats from "../imageFormats.js";
import type * as migrations_expenseContributions from "../migrations/expenseContributions.js";
import type * as migrations_expenseMemberReferences from "../migrations/expenseMemberReferences.js";
import type * as migrations_markEmailVerified from "../migrations/markEmailVerified.js";
import type * as otp_PasswordOTP from "../otp/PasswordOTP.js";
import type * as otp_ResendOTP from "../otp/ResendOTP.js";
import type * as tabs from "../tabs.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  expenseMembers: typeof expenseMembers;
  expenses: typeof expenses;
  http: typeof http;
  imageFormats: typeof imageFormats;
  "migrations/expenseContributions": typeof migrations_expenseContributions;
  "migrations/expenseMemberReferences": typeof migrations_expenseMemberReferences;
  "migrations/markEmailVerified": typeof migrations_markEmailVerified;
  "otp/PasswordOTP": typeof otp_PasswordOTP;
  "otp/ResendOTP": typeof otp_ResendOTP;
  tabs: typeof tabs;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
