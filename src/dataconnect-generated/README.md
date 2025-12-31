# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `api`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetCurrentUser*](#getcurrentuser)
  - [*GetUserById*](#getuserbyid)
  - [*ListUsers*](#listusers)
  - [*ListSections*](#listsections)
  - [*GetSectionsForUser*](#getsectionsforuser)
  - [*ListAccessGroups*](#listaccessgroups)
  - [*GetUserAccessGroups*](#getuseraccessgroups)
- [**Mutations**](#mutations)
  - [*UpsertUser*](#upsertuser)
  - [*UpdateUser*](#updateuser)
  - [*CreateSection*](#createsection)
  - [*CreateAccessGroup*](#createaccessgroup)
  - [*AddUserToAccessGroup*](#addusertoaccessgroup)
  - [*RemoveUserFromAccessGroup*](#removeuserfromaccessgroup)
  - [*GrantAccessGroupToSection*](#grantaccessgrouptosection)
  - [*RevokeAccessGroupFromSection*](#revokeaccessgroupfromsection)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `api`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `api` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetCurrentUser
You can execute the `GetCurrentUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getCurrentUser(): QueryPromise<GetCurrentUserData, undefined>;

interface GetCurrentUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
}
export const getCurrentUserRef: GetCurrentUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getCurrentUser(dc: DataConnect): QueryPromise<GetCurrentUserData, undefined>;

interface GetCurrentUserRef {
  ...
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
}
export const getCurrentUserRef: GetCurrentUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getCurrentUserRef:
```typescript
const name = getCurrentUserRef.operationName;
console.log(name);
```

### Variables
The `GetCurrentUser` query has no variables.
### Return Type
Recall that executing the `GetCurrentUser` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetCurrentUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetCurrentUserData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key;
}
```
### Using `GetCurrentUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getCurrentUser } from '@dataconnect/generated';


// Call the `getCurrentUser()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getCurrentUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getCurrentUser(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getCurrentUser().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetCurrentUser`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getCurrentUserRef } from '@dataconnect/generated';


// Call the `getCurrentUserRef()` function to get a reference to the query.
const ref = getCurrentUserRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getCurrentUserRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## GetUserById
You can execute the `GetUserById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserById(vars: GetUserByIdVariables): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserById(dc: DataConnect, vars: GetUserByIdVariables): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByIdRef:
```typescript
const name = getUserByIdRef.operationName;
console.log(name);
```

### Variables
The `GetUserById` query requires an argument of type `GetUserByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByIdVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetUserById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserByIdData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & User_Key;
}
```
### Using `GetUserById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserById, GetUserByIdVariables } from '@dataconnect/generated';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserById(getUserByIdVars);
// Variables can be defined inline as well.
const { data } = await getUserById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserById(dataConnect, getUserByIdVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserById(getUserByIdVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByIdRef, GetUserByIdVariables } from '@dataconnect/generated';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserByIdRef()` function to get a reference to the query.
const ref = getUserByIdRef(getUserByIdVars);
// Variables can be defined inline as well.
const ref = getUserByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByIdRef(dataConnect, getUserByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUsers(): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUsersData {
  users: ({
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key)[];
}
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@dataconnect/generated';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@dataconnect/generated';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## ListSections
You can execute the `ListSections` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listSections(): QueryPromise<ListSectionsData, undefined>;

interface ListSectionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSectionsData, undefined>;
}
export const listSectionsRef: ListSectionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSections(dc: DataConnect): QueryPromise<ListSectionsData, undefined>;

interface ListSectionsRef {
  ...
  (dc: DataConnect): QueryRef<ListSectionsData, undefined>;
}
export const listSectionsRef: ListSectionsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSectionsRef:
```typescript
const name = listSectionsRef.operationName;
console.log(name);
```

### Variables
The `ListSections` query has no variables.
### Return Type
Recall that executing the `ListSections` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSectionsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListSectionsData {
  sections: ({
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Section_Key)[];
}
```
### Using `ListSections`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSections } from '@dataconnect/generated';


// Call the `listSections()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSections();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSections(dataConnect);

console.log(data.sections);

// Or, you can use the `Promise` API.
listSections().then((response) => {
  const data = response.data;
  console.log(data.sections);
});
```

### Using `ListSections`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSectionsRef } from '@dataconnect/generated';


// Call the `listSectionsRef()` function to get a reference to the query.
const ref = listSectionsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSectionsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sections);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sections);
});
```

## GetSectionsForUser
You can execute the `GetSectionsForUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSectionsForUser(): QueryPromise<GetSectionsForUserData, undefined>;

interface GetSectionsForUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSectionsForUserData, undefined>;
}
export const getSectionsForUserRef: GetSectionsForUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionsForUser(dc: DataConnect): QueryPromise<GetSectionsForUserData, undefined>;

interface GetSectionsForUserRef {
  ...
  (dc: DataConnect): QueryRef<GetSectionsForUserData, undefined>;
}
export const getSectionsForUserRef: GetSectionsForUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSectionsForUserRef:
```typescript
const name = getSectionsForUserRef.operationName;
console.log(name);
```

### Variables
The `GetSectionsForUser` query has no variables.
### Return Type
Recall that executing the `GetSectionsForUser` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSectionsForUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSectionsForUserData {
  user?: {
    id: string;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        sections: ({
          section: {
            id: UUIDString;
            name: string;
            type: SectionType;
            description?: string | null;
          } & Section_Key;
        })[];
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}
```
### Using `GetSectionsForUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSectionsForUser } from '@dataconnect/generated';


// Call the `getSectionsForUser()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSectionsForUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSectionsForUser(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getSectionsForUser().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetSectionsForUser`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSectionsForUserRef } from '@dataconnect/generated';


// Call the `getSectionsForUserRef()` function to get a reference to the query.
const ref = getSectionsForUserRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSectionsForUserRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## ListAccessGroups
You can execute the `ListAccessGroups` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAccessGroups(): QueryPromise<ListAccessGroupsData, undefined>;

interface ListAccessGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAccessGroupsData, undefined>;
}
export const listAccessGroupsRef: ListAccessGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAccessGroups(dc: DataConnect): QueryPromise<ListAccessGroupsData, undefined>;

interface ListAccessGroupsRef {
  ...
  (dc: DataConnect): QueryRef<ListAccessGroupsData, undefined>;
}
export const listAccessGroupsRef: ListAccessGroupsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAccessGroupsRef:
```typescript
const name = listAccessGroupsRef.operationName;
console.log(name);
```

### Variables
The `ListAccessGroups` query has no variables.
### Return Type
Recall that executing the `ListAccessGroups` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAccessGroupsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAccessGroupsData {
  accessGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AccessGroup_Key)[];
}
```
### Using `ListAccessGroups`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAccessGroups } from '@dataconnect/generated';


// Call the `listAccessGroups()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAccessGroups();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAccessGroups(dataConnect);

console.log(data.accessGroups);

// Or, you can use the `Promise` API.
listAccessGroups().then((response) => {
  const data = response.data;
  console.log(data.accessGroups);
});
```

### Using `ListAccessGroups`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAccessGroupsRef } from '@dataconnect/generated';


// Call the `listAccessGroupsRef()` function to get a reference to the query.
const ref = listAccessGroupsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAccessGroupsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.accessGroups);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.accessGroups);
});
```

## GetUserAccessGroups
You can execute the `GetUserAccessGroups` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserAccessGroups(): QueryPromise<GetUserAccessGroupsData, undefined>;

interface GetUserAccessGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserAccessGroupsData, undefined>;
}
export const getUserAccessGroupsRef: GetUserAccessGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserAccessGroups(dc: DataConnect): QueryPromise<GetUserAccessGroupsData, undefined>;

interface GetUserAccessGroupsRef {
  ...
  (dc: DataConnect): QueryRef<GetUserAccessGroupsData, undefined>;
}
export const getUserAccessGroupsRef: GetUserAccessGroupsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserAccessGroupsRef:
```typescript
const name = getUserAccessGroupsRef.operationName;
console.log(name);
```

### Variables
The `GetUserAccessGroups` query has no variables.
### Return Type
Recall that executing the `GetUserAccessGroups` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserAccessGroupsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserAccessGroupsData {
  user?: {
    id: string;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}
```
### Using `GetUserAccessGroups`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserAccessGroups } from '@dataconnect/generated';


// Call the `getUserAccessGroups()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserAccessGroups();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserAccessGroups(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserAccessGroups().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserAccessGroups`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserAccessGroupsRef } from '@dataconnect/generated';


// Call the `getUserAccessGroupsRef()` function to get a reference to the query.
const ref = getUserAccessGroupsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserAccessGroupsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `api` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## UpsertUser
You can execute the `UpsertUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpsertUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
}
export const upsertUserRef: UpsertUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpsertUserRef {
  ...
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
}
export const upsertUserRef: UpsertUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertUserRef:
```typescript
const name = upsertUserRef.operationName;
console.log(name);
```

### Variables
The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertUserVariables {
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus?: MembershipStatus | null;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}
```
### Return Type
Recall that executing the `UpsertUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertUserData {
  user_upsert: User_Key;
}
```
### Using `UpsertUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertUser, UpsertUserVariables } from '@dataconnect/generated';

// The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`:
const upsertUserVars: UpsertUserVariables = {
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  membershipStatus: ..., // optional
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `upsertUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertUser(upsertUserVars);
// Variables can be defined inline as well.
const { data } = await upsertUser({ firstName: ..., lastName: ..., email: ..., serviceNumber: ..., membershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertUser(dataConnect, upsertUserVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
upsertUser(upsertUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `UpsertUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertUserRef, UpsertUserVariables } from '@dataconnect/generated';

// The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`:
const upsertUserVars: UpsertUserVariables = {
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  membershipStatus: ..., // optional
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `upsertUserRef()` function to get a reference to the mutation.
const ref = upsertUserRef(upsertUserVars);
// Variables can be defined inline as well.
const ref = upsertUserRef({ firstName: ..., lastName: ..., email: ..., serviceNumber: ..., membershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertUserRef(dataConnect, upsertUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## UpdateUser
You can execute the `UpdateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUser(vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUser(dc: DataConnect, vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  (dc: DataConnect, vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserRef:
```typescript
const name = updateUserRef.operationName;
console.log(name);
```

### Variables
The `UpdateUser` mutation requires an argument of type `UpdateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserVariables {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus?: MembershipStatus | null;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}
```
### Return Type
Recall that executing the `UpdateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserData {
  user_upsert: User_Key;
}
```
### Using `UpdateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUser, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation requires an argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  userId: ..., 
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  membershipStatus: ..., // optional
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `updateUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUser(updateUserVars);
// Variables can be defined inline as well.
const { data } = await updateUser({ userId: ..., firstName: ..., lastName: ..., email: ..., serviceNumber: ..., membershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUser(dataConnect, updateUserVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
updateUser(updateUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `UpdateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserRef, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation requires an argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  userId: ..., 
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  membershipStatus: ..., // optional
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `updateUserRef()` function to get a reference to the mutation.
const ref = updateUserRef(updateUserVars);
// Variables can be defined inline as well.
const ref = updateUserRef({ userId: ..., firstName: ..., lastName: ..., email: ..., serviceNumber: ..., membershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserRef(dataConnect, updateUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## CreateSection
You can execute the `CreateSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSection(vars: CreateSectionVariables): MutationPromise<CreateSectionData, CreateSectionVariables>;

interface CreateSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSectionVariables): MutationRef<CreateSectionData, CreateSectionVariables>;
}
export const createSectionRef: CreateSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSection(dc: DataConnect, vars: CreateSectionVariables): MutationPromise<CreateSectionData, CreateSectionVariables>;

interface CreateSectionRef {
  ...
  (dc: DataConnect, vars: CreateSectionVariables): MutationRef<CreateSectionData, CreateSectionVariables>;
}
export const createSectionRef: CreateSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSectionRef:
```typescript
const name = createSectionRef.operationName;
console.log(name);
```

### Variables
The `CreateSection` mutation requires an argument of type `CreateSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateSectionVariables {
  name: string;
  type: SectionType;
  description?: string | null;
}
```
### Return Type
Recall that executing the `CreateSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSectionData {
  section_insert: Section_Key;
}
```
### Using `CreateSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSection, CreateSectionVariables } from '@dataconnect/generated';

// The `CreateSection` mutation requires an argument of type `CreateSectionVariables`:
const createSectionVars: CreateSectionVariables = {
  name: ..., 
  type: ..., 
  description: ..., // optional
};

// Call the `createSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSection(createSectionVars);
// Variables can be defined inline as well.
const { data } = await createSection({ name: ..., type: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSection(dataConnect, createSectionVars);

console.log(data.section_insert);

// Or, you can use the `Promise` API.
createSection(createSectionVars).then((response) => {
  const data = response.data;
  console.log(data.section_insert);
});
```

### Using `CreateSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSectionRef, CreateSectionVariables } from '@dataconnect/generated';

// The `CreateSection` mutation requires an argument of type `CreateSectionVariables`:
const createSectionVars: CreateSectionVariables = {
  name: ..., 
  type: ..., 
  description: ..., // optional
};

// Call the `createSectionRef()` function to get a reference to the mutation.
const ref = createSectionRef(createSectionVars);
// Variables can be defined inline as well.
const ref = createSectionRef({ name: ..., type: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSectionRef(dataConnect, createSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.section_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.section_insert);
});
```

## CreateAccessGroup
You can execute the `CreateAccessGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAccessGroup(vars: CreateAccessGroupVariables): MutationPromise<CreateAccessGroupData, CreateAccessGroupVariables>;

interface CreateAccessGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccessGroupVariables): MutationRef<CreateAccessGroupData, CreateAccessGroupVariables>;
}
export const createAccessGroupRef: CreateAccessGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAccessGroup(dc: DataConnect, vars: CreateAccessGroupVariables): MutationPromise<CreateAccessGroupData, CreateAccessGroupVariables>;

interface CreateAccessGroupRef {
  ...
  (dc: DataConnect, vars: CreateAccessGroupVariables): MutationRef<CreateAccessGroupData, CreateAccessGroupVariables>;
}
export const createAccessGroupRef: CreateAccessGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAccessGroupRef:
```typescript
const name = createAccessGroupRef.operationName;
console.log(name);
```

### Variables
The `CreateAccessGroup` mutation requires an argument of type `CreateAccessGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAccessGroupVariables {
  name: string;
  description?: string | null;
}
```
### Return Type
Recall that executing the `CreateAccessGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAccessGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAccessGroupData {
  accessGroup_insert: AccessGroup_Key;
}
```
### Using `CreateAccessGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAccessGroup, CreateAccessGroupVariables } from '@dataconnect/generated';

// The `CreateAccessGroup` mutation requires an argument of type `CreateAccessGroupVariables`:
const createAccessGroupVars: CreateAccessGroupVariables = {
  name: ..., 
  description: ..., // optional
};

// Call the `createAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAccessGroup(createAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await createAccessGroup({ name: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAccessGroup(dataConnect, createAccessGroupVars);

console.log(data.accessGroup_insert);

// Or, you can use the `Promise` API.
createAccessGroup(createAccessGroupVars).then((response) => {
  const data = response.data;
  console.log(data.accessGroup_insert);
});
```

### Using `CreateAccessGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAccessGroupRef, CreateAccessGroupVariables } from '@dataconnect/generated';

// The `CreateAccessGroup` mutation requires an argument of type `CreateAccessGroupVariables`:
const createAccessGroupVars: CreateAccessGroupVariables = {
  name: ..., 
  description: ..., // optional
};

// Call the `createAccessGroupRef()` function to get a reference to the mutation.
const ref = createAccessGroupRef(createAccessGroupVars);
// Variables can be defined inline as well.
const ref = createAccessGroupRef({ name: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAccessGroupRef(dataConnect, createAccessGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accessGroup_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accessGroup_insert);
});
```

## AddUserToAccessGroup
You can execute the `AddUserToAccessGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addUserToAccessGroup(vars: AddUserToAccessGroupVariables): MutationPromise<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;

interface AddUserToAccessGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToAccessGroupVariables): MutationRef<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;
}
export const addUserToAccessGroupRef: AddUserToAccessGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addUserToAccessGroup(dc: DataConnect, vars: AddUserToAccessGroupVariables): MutationPromise<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;

interface AddUserToAccessGroupRef {
  ...
  (dc: DataConnect, vars: AddUserToAccessGroupVariables): MutationRef<AddUserToAccessGroupData, AddUserToAccessGroupVariables>;
}
export const addUserToAccessGroupRef: AddUserToAccessGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addUserToAccessGroupRef:
```typescript
const name = addUserToAccessGroupRef.operationName;
console.log(name);
```

### Variables
The `AddUserToAccessGroup` mutation requires an argument of type `AddUserToAccessGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddUserToAccessGroupVariables {
  userId: string;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `AddUserToAccessGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddUserToAccessGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddUserToAccessGroupData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}
```
### Using `AddUserToAccessGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addUserToAccessGroup, AddUserToAccessGroupVariables } from '@dataconnect/generated';

// The `AddUserToAccessGroup` mutation requires an argument of type `AddUserToAccessGroupVariables`:
const addUserToAccessGroupVars: AddUserToAccessGroupVariables = {
  userId: ..., 
  accessGroupId: ..., 
};

// Call the `addUserToAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addUserToAccessGroup(addUserToAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await addUserToAccessGroup({ userId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addUserToAccessGroup(dataConnect, addUserToAccessGroupVars);

console.log(data.userAccessGroup_upsert);

// Or, you can use the `Promise` API.
addUserToAccessGroup(addUserToAccessGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_upsert);
});
```

### Using `AddUserToAccessGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addUserToAccessGroupRef, AddUserToAccessGroupVariables } from '@dataconnect/generated';

// The `AddUserToAccessGroup` mutation requires an argument of type `AddUserToAccessGroupVariables`:
const addUserToAccessGroupVars: AddUserToAccessGroupVariables = {
  userId: ..., 
  accessGroupId: ..., 
};

// Call the `addUserToAccessGroupRef()` function to get a reference to the mutation.
const ref = addUserToAccessGroupRef(addUserToAccessGroupVars);
// Variables can be defined inline as well.
const ref = addUserToAccessGroupRef({ userId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addUserToAccessGroupRef(dataConnect, addUserToAccessGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userAccessGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_upsert);
});
```

## RemoveUserFromAccessGroup
You can execute the `RemoveUserFromAccessGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeUserFromAccessGroup(vars: RemoveUserFromAccessGroupVariables): MutationPromise<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;

interface RemoveUserFromAccessGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromAccessGroupVariables): MutationRef<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;
}
export const removeUserFromAccessGroupRef: RemoveUserFromAccessGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeUserFromAccessGroup(dc: DataConnect, vars: RemoveUserFromAccessGroupVariables): MutationPromise<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;

interface RemoveUserFromAccessGroupRef {
  ...
  (dc: DataConnect, vars: RemoveUserFromAccessGroupVariables): MutationRef<RemoveUserFromAccessGroupData, RemoveUserFromAccessGroupVariables>;
}
export const removeUserFromAccessGroupRef: RemoveUserFromAccessGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeUserFromAccessGroupRef:
```typescript
const name = removeUserFromAccessGroupRef.operationName;
console.log(name);
```

### Variables
The `RemoveUserFromAccessGroup` mutation requires an argument of type `RemoveUserFromAccessGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveUserFromAccessGroupVariables {
  userId: string;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RemoveUserFromAccessGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveUserFromAccessGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveUserFromAccessGroupData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}
```
### Using `RemoveUserFromAccessGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeUserFromAccessGroup, RemoveUserFromAccessGroupVariables } from '@dataconnect/generated';

// The `RemoveUserFromAccessGroup` mutation requires an argument of type `RemoveUserFromAccessGroupVariables`:
const removeUserFromAccessGroupVars: RemoveUserFromAccessGroupVariables = {
  userId: ..., 
  accessGroupId: ..., 
};

// Call the `removeUserFromAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeUserFromAccessGroup(removeUserFromAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await removeUserFromAccessGroup({ userId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeUserFromAccessGroup(dataConnect, removeUserFromAccessGroupVars);

console.log(data.userAccessGroup_delete);

// Or, you can use the `Promise` API.
removeUserFromAccessGroup(removeUserFromAccessGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_delete);
});
```

### Using `RemoveUserFromAccessGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeUserFromAccessGroupRef, RemoveUserFromAccessGroupVariables } from '@dataconnect/generated';

// The `RemoveUserFromAccessGroup` mutation requires an argument of type `RemoveUserFromAccessGroupVariables`:
const removeUserFromAccessGroupVars: RemoveUserFromAccessGroupVariables = {
  userId: ..., 
  accessGroupId: ..., 
};

// Call the `removeUserFromAccessGroupRef()` function to get a reference to the mutation.
const ref = removeUserFromAccessGroupRef(removeUserFromAccessGroupVars);
// Variables can be defined inline as well.
const ref = removeUserFromAccessGroupRef({ userId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeUserFromAccessGroupRef(dataConnect, removeUserFromAccessGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userAccessGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_delete);
});
```

## GrantAccessGroupToSection
You can execute the `GrantAccessGroupToSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
grantAccessGroupToSection(vars: GrantAccessGroupToSectionVariables): MutationPromise<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;

interface GrantAccessGroupToSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantAccessGroupToSectionVariables): MutationRef<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;
}
export const grantAccessGroupToSectionRef: GrantAccessGroupToSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
grantAccessGroupToSection(dc: DataConnect, vars: GrantAccessGroupToSectionVariables): MutationPromise<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;

interface GrantAccessGroupToSectionRef {
  ...
  (dc: DataConnect, vars: GrantAccessGroupToSectionVariables): MutationRef<GrantAccessGroupToSectionData, GrantAccessGroupToSectionVariables>;
}
export const grantAccessGroupToSectionRef: GrantAccessGroupToSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the grantAccessGroupToSectionRef:
```typescript
const name = grantAccessGroupToSectionRef.operationName;
console.log(name);
```

### Variables
The `GrantAccessGroupToSection` mutation requires an argument of type `GrantAccessGroupToSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GrantAccessGroupToSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `GrantAccessGroupToSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GrantAccessGroupToSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GrantAccessGroupToSectionData {
  sectionAccessGroup_upsert: SectionAccessGroup_Key;
}
```
### Using `GrantAccessGroupToSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, grantAccessGroupToSection, GrantAccessGroupToSectionVariables } from '@dataconnect/generated';

// The `GrantAccessGroupToSection` mutation requires an argument of type `GrantAccessGroupToSectionVariables`:
const grantAccessGroupToSectionVars: GrantAccessGroupToSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `grantAccessGroupToSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await grantAccessGroupToSection(grantAccessGroupToSectionVars);
// Variables can be defined inline as well.
const { data } = await grantAccessGroupToSection({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await grantAccessGroupToSection(dataConnect, grantAccessGroupToSectionVars);

console.log(data.sectionAccessGroup_upsert);

// Or, you can use the `Promise` API.
grantAccessGroupToSection(grantAccessGroupToSectionVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAccessGroup_upsert);
});
```

### Using `GrantAccessGroupToSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, grantAccessGroupToSectionRef, GrantAccessGroupToSectionVariables } from '@dataconnect/generated';

// The `GrantAccessGroupToSection` mutation requires an argument of type `GrantAccessGroupToSectionVariables`:
const grantAccessGroupToSectionVars: GrantAccessGroupToSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `grantAccessGroupToSectionRef()` function to get a reference to the mutation.
const ref = grantAccessGroupToSectionRef(grantAccessGroupToSectionVars);
// Variables can be defined inline as well.
const ref = grantAccessGroupToSectionRef({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = grantAccessGroupToSectionRef(dataConnect, grantAccessGroupToSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionAccessGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAccessGroup_upsert);
});
```

## RevokeAccessGroupFromSection
You can execute the `RevokeAccessGroupFromSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
revokeAccessGroupFromSection(vars: RevokeAccessGroupFromSectionVariables): MutationPromise<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;

interface RevokeAccessGroupFromSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeAccessGroupFromSectionVariables): MutationRef<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;
}
export const revokeAccessGroupFromSectionRef: RevokeAccessGroupFromSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
revokeAccessGroupFromSection(dc: DataConnect, vars: RevokeAccessGroupFromSectionVariables): MutationPromise<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;

interface RevokeAccessGroupFromSectionRef {
  ...
  (dc: DataConnect, vars: RevokeAccessGroupFromSectionVariables): MutationRef<RevokeAccessGroupFromSectionData, RevokeAccessGroupFromSectionVariables>;
}
export const revokeAccessGroupFromSectionRef: RevokeAccessGroupFromSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the revokeAccessGroupFromSectionRef:
```typescript
const name = revokeAccessGroupFromSectionRef.operationName;
console.log(name);
```

### Variables
The `RevokeAccessGroupFromSection` mutation requires an argument of type `RevokeAccessGroupFromSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RevokeAccessGroupFromSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RevokeAccessGroupFromSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RevokeAccessGroupFromSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RevokeAccessGroupFromSectionData {
  sectionAccessGroup_delete?: SectionAccessGroup_Key | null;
}
```
### Using `RevokeAccessGroupFromSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, revokeAccessGroupFromSection, RevokeAccessGroupFromSectionVariables } from '@dataconnect/generated';

// The `RevokeAccessGroupFromSection` mutation requires an argument of type `RevokeAccessGroupFromSectionVariables`:
const revokeAccessGroupFromSectionVars: RevokeAccessGroupFromSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `revokeAccessGroupFromSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await revokeAccessGroupFromSection(revokeAccessGroupFromSectionVars);
// Variables can be defined inline as well.
const { data } = await revokeAccessGroupFromSection({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await revokeAccessGroupFromSection(dataConnect, revokeAccessGroupFromSectionVars);

console.log(data.sectionAccessGroup_delete);

// Or, you can use the `Promise` API.
revokeAccessGroupFromSection(revokeAccessGroupFromSectionVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAccessGroup_delete);
});
```

### Using `RevokeAccessGroupFromSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, revokeAccessGroupFromSectionRef, RevokeAccessGroupFromSectionVariables } from '@dataconnect/generated';

// The `RevokeAccessGroupFromSection` mutation requires an argument of type `RevokeAccessGroupFromSectionVariables`:
const revokeAccessGroupFromSectionVars: RevokeAccessGroupFromSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `revokeAccessGroupFromSectionRef()` function to get a reference to the mutation.
const ref = revokeAccessGroupFromSectionRef(revokeAccessGroupFromSectionVars);
// Variables can be defined inline as well.
const ref = revokeAccessGroupFromSectionRef({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = revokeAccessGroupFromSectionRef(dataConnect, revokeAccessGroupFromSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionAccessGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAccessGroup_delete);
});
```

