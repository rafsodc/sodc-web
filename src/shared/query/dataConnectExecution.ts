import { executeMutation, executeQuery } from "firebase/data-connect";
import { withTimeout } from "../utils/withTimeout";

export const DATA_CONNECT_OPERATION_TIMEOUT_MS = 30_000;

const timedExecuteQuery = (...args: Parameters<typeof executeQuery>) =>
  withTimeout(
    executeQuery(...args),
    DATA_CONNECT_OPERATION_TIMEOUT_MS,
    "The Data Connect query timed out",
  );

const timedExecuteMutation = (...args: Parameters<typeof executeMutation>) =>
  withTimeout(
    executeMutation(...args),
    DATA_CONNECT_OPERATION_TIMEOUT_MS,
    "The Data Connect mutation timed out",
  );

export const executeDataConnectQuery = timedExecuteQuery as typeof executeQuery;
export const executeDataConnectMutation = timedExecuteMutation as typeof executeMutation;
