# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `api`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetAccessGroupByName*](#getaccessgroupbyname)
  - [*GetUserAccessGroupsForAdmin*](#getuseraccessgroupsforadmin)
  - [*GetCurrentUser*](#getcurrentuser)
  - [*GetUserById*](#getuserbyid)
  - [*ListUsers*](#listusers)
  - [*ListSections*](#listsections)
  - [*GetSectionsForUser*](#getsectionsforuser)
  - [*ListAccessGroups*](#listaccessgroups)
  - [*GetUserAccessGroups*](#getuseraccessgroups)
  - [*CheckUserProfileExists*](#checkuserprofileexists)
  - [*GetUserMembershipStatus*](#getusermembershipstatus)
  - [*GetUserWithAccessGroups*](#getuserwithaccessgroups)
  - [*GetUserAccessGroupsById*](#getuseraccessgroupsbyid)
  - [*GetSectionById*](#getsectionbyid)
  - [*GetAccessGroupById*](#getaccessgroupbyid)
  - [*GetAllAccessGroupsWithStatuses*](#getallaccessgroupswithstatuses)
  - [*GetSectionMembers*](#getsectionmembers)
- [**Mutations**](#mutations)
  - [*CreateSection*](#createsection)
  - [*CreateAccessGroup*](#createaccessgroup)
  - [*AddUserToAccessGroup*](#addusertoaccessgroup)
  - [*RemoveUserFromAccessGroup*](#removeuserfromaccessgroup)
  - [*GrantViewAccessGroupToSection*](#grantviewaccessgrouptosection)
  - [*RevokeViewAccessGroupFromSection*](#revokeviewaccessgroupfromsection)
  - [*GrantMemberAccessGroupToSection*](#grantmemberaccessgrouptosection)
  - [*RevokeMemberAccessGroupFromSection*](#revokememberaccessgroupfromsection)
  - [*UpdateAccessGroup*](#updateaccessgroup)
  - [*DeleteAccessGroup*](#deleteaccessgroup)
  - [*UpdateSection*](#updatesection)
  - [*DeleteSection*](#deletesection)
  - [*UpdateUserMembershipStatus*](#updateusermembershipstatus)
  - [*DeleteUser*](#deleteuser)
  - [*CreateUser*](#createuser)
  - [*CreateAccessGroupAdmin*](#createaccessgroupadmin)
  - [*AddUserToAccessGroupAdmin*](#addusertoaccessgroupadmin)
  - [*RemoveUserFromAccessGroupAdmin*](#removeuserfromaccessgroupadmin)
  - [*CreateUserProfile*](#createuserprofile)
  - [*UpsertUser*](#upsertuser)
  - [*UpdateUser*](#updateuser)
  - [*RegisterForSection*](#registerforsection)
  - [*UnregisterFromSection*](#unregisterfromsection)
  - [*SubscribeToAccessGroup*](#subscribetoaccessgroup)
  - [*UnsubscribeFromAccessGroup*](#unsubscribefromaccessgroup)

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

## GetAccessGroupByName
You can execute the `GetAccessGroupByName` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAccessGroupByName(vars: GetAccessGroupByNameVariables): QueryPromise<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;

interface GetAccessGroupByNameRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAccessGroupByNameVariables): QueryRef<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;
}
export const getAccessGroupByNameRef: GetAccessGroupByNameRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAccessGroupByName(dc: DataConnect, vars: GetAccessGroupByNameVariables): QueryPromise<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;

interface GetAccessGroupByNameRef {
  ...
  (dc: DataConnect, vars: GetAccessGroupByNameVariables): QueryRef<GetAccessGroupByNameData, GetAccessGroupByNameVariables>;
}
export const getAccessGroupByNameRef: GetAccessGroupByNameRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAccessGroupByNameRef:
```typescript
const name = getAccessGroupByNameRef.operationName;
console.log(name);
```

### Variables
The `GetAccessGroupByName` query requires an argument of type `GetAccessGroupByNameVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAccessGroupByNameVariables {
  name: string;
}
```
### Return Type
Recall that executing the `GetAccessGroupByName` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAccessGroupByNameData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAccessGroupByNameData {
  accessGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
  } & AccessGroup_Key)[];
}
```
### Using `GetAccessGroupByName`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAccessGroupByName, GetAccessGroupByNameVariables } from '@dataconnect/generated';

// The `GetAccessGroupByName` query requires an argument of type `GetAccessGroupByNameVariables`:
const getAccessGroupByNameVars: GetAccessGroupByNameVariables = {
  name: ..., 
};

// Call the `getAccessGroupByName()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAccessGroupByName(getAccessGroupByNameVars);
// Variables can be defined inline as well.
const { data } = await getAccessGroupByName({ name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAccessGroupByName(dataConnect, getAccessGroupByNameVars);

console.log(data.accessGroups);

// Or, you can use the `Promise` API.
getAccessGroupByName(getAccessGroupByNameVars).then((response) => {
  const data = response.data;
  console.log(data.accessGroups);
});
```

### Using `GetAccessGroupByName`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAccessGroupByNameRef, GetAccessGroupByNameVariables } from '@dataconnect/generated';

// The `GetAccessGroupByName` query requires an argument of type `GetAccessGroupByNameVariables`:
const getAccessGroupByNameVars: GetAccessGroupByNameVariables = {
  name: ..., 
};

// Call the `getAccessGroupByNameRef()` function to get a reference to the query.
const ref = getAccessGroupByNameRef(getAccessGroupByNameVars);
// Variables can be defined inline as well.
const ref = getAccessGroupByNameRef({ name: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAccessGroupByNameRef(dataConnect, getAccessGroupByNameVars);

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

## GetUserAccessGroupsForAdmin
You can execute the `GetUserAccessGroupsForAdmin` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserAccessGroupsForAdmin(vars: GetUserAccessGroupsForAdminVariables): QueryPromise<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;

interface GetUserAccessGroupsForAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserAccessGroupsForAdminVariables): QueryRef<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;
}
export const getUserAccessGroupsForAdminRef: GetUserAccessGroupsForAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserAccessGroupsForAdmin(dc: DataConnect, vars: GetUserAccessGroupsForAdminVariables): QueryPromise<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;

interface GetUserAccessGroupsForAdminRef {
  ...
  (dc: DataConnect, vars: GetUserAccessGroupsForAdminVariables): QueryRef<GetUserAccessGroupsForAdminData, GetUserAccessGroupsForAdminVariables>;
}
export const getUserAccessGroupsForAdminRef: GetUserAccessGroupsForAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserAccessGroupsForAdminRef:
```typescript
const name = getUserAccessGroupsForAdminRef.operationName;
console.log(name);
```

### Variables
The `GetUserAccessGroupsForAdmin` query requires an argument of type `GetUserAccessGroupsForAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserAccessGroupsForAdminVariables {
  userId: string;
}
```
### Return Type
Recall that executing the `GetUserAccessGroupsForAdmin` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserAccessGroupsForAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserAccessGroupsForAdminData {
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
### Using `GetUserAccessGroupsForAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserAccessGroupsForAdmin, GetUserAccessGroupsForAdminVariables } from '@dataconnect/generated';

// The `GetUserAccessGroupsForAdmin` query requires an argument of type `GetUserAccessGroupsForAdminVariables`:
const getUserAccessGroupsForAdminVars: GetUserAccessGroupsForAdminVariables = {
  userId: ..., 
};

// Call the `getUserAccessGroupsForAdmin()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserAccessGroupsForAdmin(getUserAccessGroupsForAdminVars);
// Variables can be defined inline as well.
const { data } = await getUserAccessGroupsForAdmin({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserAccessGroupsForAdmin(dataConnect, getUserAccessGroupsForAdminVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserAccessGroupsForAdmin(getUserAccessGroupsForAdminVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserAccessGroupsForAdmin`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserAccessGroupsForAdminRef, GetUserAccessGroupsForAdminVariables } from '@dataconnect/generated';

// The `GetUserAccessGroupsForAdmin` query requires an argument of type `GetUserAccessGroupsForAdminVariables`:
const getUserAccessGroupsForAdminVars: GetUserAccessGroupsForAdminVariables = {
  userId: ..., 
};

// Call the `getUserAccessGroupsForAdminRef()` function to get a reference to the query.
const ref = getUserAccessGroupsForAdminRef(getUserAccessGroupsForAdminVars);
// Variables can be defined inline as well.
const ref = getUserAccessGroupsForAdminRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserAccessGroupsForAdminRef(dataConnect, getUserAccessGroupsForAdminVars);

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
    requestedMembershipStatus?: MembershipStatus | null;
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
    requestedMembershipStatus?: MembershipStatus | null;
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
    requestedMembershipStatus?: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
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
    createdBy?: string | null;
    updatedBy?: string | null;
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
    membershipStatuses?: MembershipStatus[] | null;
    subscribable?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
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

## CheckUserProfileExists
You can execute the `CheckUserProfileExists` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
checkUserProfileExists(): QueryPromise<CheckUserProfileExistsData, undefined>;

interface CheckUserProfileExistsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<CheckUserProfileExistsData, undefined>;
}
export const checkUserProfileExistsRef: CheckUserProfileExistsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
checkUserProfileExists(dc: DataConnect): QueryPromise<CheckUserProfileExistsData, undefined>;

interface CheckUserProfileExistsRef {
  ...
  (dc: DataConnect): QueryRef<CheckUserProfileExistsData, undefined>;
}
export const checkUserProfileExistsRef: CheckUserProfileExistsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the checkUserProfileExistsRef:
```typescript
const name = checkUserProfileExistsRef.operationName;
console.log(name);
```

### Variables
The `CheckUserProfileExists` query has no variables.
### Return Type
Recall that executing the `CheckUserProfileExists` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CheckUserProfileExistsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CheckUserProfileExistsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    membershipStatus: MembershipStatus;
  } & User_Key;
}
```
### Using `CheckUserProfileExists`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, checkUserProfileExists } from '@dataconnect/generated';


// Call the `checkUserProfileExists()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await checkUserProfileExists();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await checkUserProfileExists(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
checkUserProfileExists().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `CheckUserProfileExists`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, checkUserProfileExistsRef } from '@dataconnect/generated';


// Call the `checkUserProfileExistsRef()` function to get a reference to the query.
const ref = checkUserProfileExistsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = checkUserProfileExistsRef(dataConnect);

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

## GetUserMembershipStatus
You can execute the `GetUserMembershipStatus` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserMembershipStatus(vars: GetUserMembershipStatusVariables): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

interface GetUserMembershipStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
}
export const getUserMembershipStatusRef: GetUserMembershipStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserMembershipStatus(dc: DataConnect, vars: GetUserMembershipStatusVariables): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

interface GetUserMembershipStatusRef {
  ...
  (dc: DataConnect, vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
}
export const getUserMembershipStatusRef: GetUserMembershipStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserMembershipStatusRef:
```typescript
const name = getUserMembershipStatusRef.operationName;
console.log(name);
```

### Variables
The `GetUserMembershipStatus` query requires an argument of type `GetUserMembershipStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserMembershipStatusVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetUserMembershipStatus` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserMembershipStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserMembershipStatusData {
  user?: {
    membershipStatus: MembershipStatus;
  };
}
```
### Using `GetUserMembershipStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserMembershipStatus, GetUserMembershipStatusVariables } from '@dataconnect/generated';

// The `GetUserMembershipStatus` query requires an argument of type `GetUserMembershipStatusVariables`:
const getUserMembershipStatusVars: GetUserMembershipStatusVariables = {
  id: ..., 
};

// Call the `getUserMembershipStatus()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserMembershipStatus(getUserMembershipStatusVars);
// Variables can be defined inline as well.
const { data } = await getUserMembershipStatus({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserMembershipStatus(dataConnect, getUserMembershipStatusVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserMembershipStatus(getUserMembershipStatusVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserMembershipStatus`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserMembershipStatusRef, GetUserMembershipStatusVariables } from '@dataconnect/generated';

// The `GetUserMembershipStatus` query requires an argument of type `GetUserMembershipStatusVariables`:
const getUserMembershipStatusVars: GetUserMembershipStatusVariables = {
  id: ..., 
};

// Call the `getUserMembershipStatusRef()` function to get a reference to the query.
const ref = getUserMembershipStatusRef(getUserMembershipStatusVars);
// Variables can be defined inline as well.
const ref = getUserMembershipStatusRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserMembershipStatusRef(dataConnect, getUserMembershipStatusVars);

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

## GetUserWithAccessGroups
You can execute the `GetUserWithAccessGroups` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserWithAccessGroups(vars: GetUserWithAccessGroupsVariables): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;

interface GetUserWithAccessGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
}
export const getUserWithAccessGroupsRef: GetUserWithAccessGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserWithAccessGroups(dc: DataConnect, vars: GetUserWithAccessGroupsVariables): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;

interface GetUserWithAccessGroupsRef {
  ...
  (dc: DataConnect, vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
}
export const getUserWithAccessGroupsRef: GetUserWithAccessGroupsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserWithAccessGroupsRef:
```typescript
const name = getUserWithAccessGroupsRef.operationName;
console.log(name);
```

### Variables
The `GetUserWithAccessGroups` query requires an argument of type `GetUserWithAccessGroupsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserWithAccessGroupsVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetUserWithAccessGroups` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserWithAccessGroupsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserWithAccessGroupsData {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    membershipStatus: MembershipStatus;
    accessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        membershipStatuses?: MembershipStatus[] | null;
      } & AccessGroup_Key;
    })[];
  } & User_Key;
}
```
### Using `GetUserWithAccessGroups`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserWithAccessGroups, GetUserWithAccessGroupsVariables } from '@dataconnect/generated';

// The `GetUserWithAccessGroups` query requires an argument of type `GetUserWithAccessGroupsVariables`:
const getUserWithAccessGroupsVars: GetUserWithAccessGroupsVariables = {
  id: ..., 
};

// Call the `getUserWithAccessGroups()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserWithAccessGroups(getUserWithAccessGroupsVars);
// Variables can be defined inline as well.
const { data } = await getUserWithAccessGroups({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserWithAccessGroups(dataConnect, getUserWithAccessGroupsVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserWithAccessGroups(getUserWithAccessGroupsVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserWithAccessGroups`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserWithAccessGroupsRef, GetUserWithAccessGroupsVariables } from '@dataconnect/generated';

// The `GetUserWithAccessGroups` query requires an argument of type `GetUserWithAccessGroupsVariables`:
const getUserWithAccessGroupsVars: GetUserWithAccessGroupsVariables = {
  id: ..., 
};

// Call the `getUserWithAccessGroupsRef()` function to get a reference to the query.
const ref = getUserWithAccessGroupsRef(getUserWithAccessGroupsVars);
// Variables can be defined inline as well.
const ref = getUserWithAccessGroupsRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserWithAccessGroupsRef(dataConnect, getUserWithAccessGroupsVars);

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

## GetUserAccessGroupsById
You can execute the `GetUserAccessGroupsById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserAccessGroupsById(vars: GetUserAccessGroupsByIdVariables): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;

interface GetUserAccessGroupsByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
}
export const getUserAccessGroupsByIdRef: GetUserAccessGroupsByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserAccessGroupsById(dc: DataConnect, vars: GetUserAccessGroupsByIdVariables): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;

interface GetUserAccessGroupsByIdRef {
  ...
  (dc: DataConnect, vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
}
export const getUserAccessGroupsByIdRef: GetUserAccessGroupsByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserAccessGroupsByIdRef:
```typescript
const name = getUserAccessGroupsByIdRef.operationName;
console.log(name);
```

### Variables
The `GetUserAccessGroupsById` query requires an argument of type `GetUserAccessGroupsByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserAccessGroupsByIdVariables {
  userId: string;
}
```
### Return Type
Recall that executing the `GetUserAccessGroupsById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserAccessGroupsByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserAccessGroupsByIdData {
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
### Using `GetUserAccessGroupsById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserAccessGroupsById, GetUserAccessGroupsByIdVariables } from '@dataconnect/generated';

// The `GetUserAccessGroupsById` query requires an argument of type `GetUserAccessGroupsByIdVariables`:
const getUserAccessGroupsByIdVars: GetUserAccessGroupsByIdVariables = {
  userId: ..., 
};

// Call the `getUserAccessGroupsById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserAccessGroupsById(getUserAccessGroupsByIdVars);
// Variables can be defined inline as well.
const { data } = await getUserAccessGroupsById({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserAccessGroupsById(dataConnect, getUserAccessGroupsByIdVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserAccessGroupsById(getUserAccessGroupsByIdVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserAccessGroupsById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserAccessGroupsByIdRef, GetUserAccessGroupsByIdVariables } from '@dataconnect/generated';

// The `GetUserAccessGroupsById` query requires an argument of type `GetUserAccessGroupsByIdVariables`:
const getUserAccessGroupsByIdVars: GetUserAccessGroupsByIdVariables = {
  userId: ..., 
};

// Call the `getUserAccessGroupsByIdRef()` function to get a reference to the query.
const ref = getUserAccessGroupsByIdRef(getUserAccessGroupsByIdVars);
// Variables can be defined inline as well.
const ref = getUserAccessGroupsByIdRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserAccessGroupsByIdRef(dataConnect, getUserAccessGroupsByIdVars);

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

## GetSectionById
You can execute the `GetSectionById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSectionById(vars: GetSectionByIdVariables): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;

interface GetSectionByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
}
export const getSectionByIdRef: GetSectionByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionById(dc: DataConnect, vars: GetSectionByIdVariables): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;

interface GetSectionByIdRef {
  ...
  (dc: DataConnect, vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
}
export const getSectionByIdRef: GetSectionByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSectionByIdRef:
```typescript
const name = getSectionByIdRef.operationName;
console.log(name);
```

### Variables
The `GetSectionById` query requires an argument of type `GetSectionByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSectionByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetSectionById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSectionByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSectionByIdData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    isOpenForRegistration?: boolean | null;
    allowedAccessGroups?: UUIDString[] | null;
    viewingAccessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
      } & AccessGroup_Key;
    })[];
      memberAccessGroups: ({
        accessGroup: {
          id: UUIDString;
          name: string;
          description?: string | null;
          subscribable?: boolean | null;
        } & AccessGroup_Key;
      })[];
  } & Section_Key;
}
```
### Using `GetSectionById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSectionById, GetSectionByIdVariables } from '@dataconnect/generated';

// The `GetSectionById` query requires an argument of type `GetSectionByIdVariables`:
const getSectionByIdVars: GetSectionByIdVariables = {
  id: ..., 
};

// Call the `getSectionById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSectionById(getSectionByIdVars);
// Variables can be defined inline as well.
const { data } = await getSectionById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSectionById(dataConnect, getSectionByIdVars);

console.log(data.section);

// Or, you can use the `Promise` API.
getSectionById(getSectionByIdVars).then((response) => {
  const data = response.data;
  console.log(data.section);
});
```

### Using `GetSectionById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSectionByIdRef, GetSectionByIdVariables } from '@dataconnect/generated';

// The `GetSectionById` query requires an argument of type `GetSectionByIdVariables`:
const getSectionByIdVars: GetSectionByIdVariables = {
  id: ..., 
};

// Call the `getSectionByIdRef()` function to get a reference to the query.
const ref = getSectionByIdRef(getSectionByIdVars);
// Variables can be defined inline as well.
const ref = getSectionByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSectionByIdRef(dataConnect, getSectionByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.section);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.section);
});
```

## GetAccessGroupById
You can execute the `GetAccessGroupById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAccessGroupById(vars: GetAccessGroupByIdVariables): QueryPromise<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;

interface GetAccessGroupByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAccessGroupByIdVariables): QueryRef<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;
}
export const getAccessGroupByIdRef: GetAccessGroupByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAccessGroupById(dc: DataConnect, vars: GetAccessGroupByIdVariables): QueryPromise<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;

interface GetAccessGroupByIdRef {
  ...
  (dc: DataConnect, vars: GetAccessGroupByIdVariables): QueryRef<GetAccessGroupByIdData, GetAccessGroupByIdVariables>;
}
export const getAccessGroupByIdRef: GetAccessGroupByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAccessGroupByIdRef:
```typescript
const name = getAccessGroupByIdRef.operationName;
console.log(name);
```

### Variables
The `GetAccessGroupById` query requires an argument of type `GetAccessGroupByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAccessGroupByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetAccessGroupById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAccessGroupByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAccessGroupByIdData {
  accessGroup?: {
    id: UUIDString;
    name: string;
    description?: string | null;
    membershipStatuses?: MembershipStatus[] | null;
    subscribable?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
    users: ({
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        membershipStatus: MembershipStatus;
      } & User_Key;
    })[];
      viewingSections: ({
        section: {
          id: UUIDString;
          name: string;
          type: SectionType;
          description?: string | null;
        } & Section_Key;
      })[];
        memberSections: ({
          section: {
            id: UUIDString;
            name: string;
            type: SectionType;
            description?: string | null;
          } & Section_Key;
        })[];
  } & AccessGroup_Key;
}
```
### Using `GetAccessGroupById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAccessGroupById, GetAccessGroupByIdVariables } from '@dataconnect/generated';

// The `GetAccessGroupById` query requires an argument of type `GetAccessGroupByIdVariables`:
const getAccessGroupByIdVars: GetAccessGroupByIdVariables = {
  id: ..., 
};

// Call the `getAccessGroupById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAccessGroupById(getAccessGroupByIdVars);
// Variables can be defined inline as well.
const { data } = await getAccessGroupById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAccessGroupById(dataConnect, getAccessGroupByIdVars);

console.log(data.accessGroup);

// Or, you can use the `Promise` API.
getAccessGroupById(getAccessGroupByIdVars).then((response) => {
  const data = response.data;
  console.log(data.accessGroup);
});
```

### Using `GetAccessGroupById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAccessGroupByIdRef, GetAccessGroupByIdVariables } from '@dataconnect/generated';

// The `GetAccessGroupById` query requires an argument of type `GetAccessGroupByIdVariables`:
const getAccessGroupByIdVars: GetAccessGroupByIdVariables = {
  id: ..., 
};

// Call the `getAccessGroupByIdRef()` function to get a reference to the query.
const ref = getAccessGroupByIdRef(getAccessGroupByIdVars);
// Variables can be defined inline as well.
const ref = getAccessGroupByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAccessGroupByIdRef(dataConnect, getAccessGroupByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.accessGroup);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.accessGroup);
});
```

## GetAllAccessGroupsWithStatuses
You can execute the `GetAllAccessGroupsWithStatuses` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAllAccessGroupsWithStatuses(): QueryPromise<GetAllAccessGroupsWithStatusesData, undefined>;

interface GetAllAccessGroupsWithStatusesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllAccessGroupsWithStatusesData, undefined>;
}
export const getAllAccessGroupsWithStatusesRef: GetAllAccessGroupsWithStatusesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAllAccessGroupsWithStatuses(dc: DataConnect): QueryPromise<GetAllAccessGroupsWithStatusesData, undefined>;

interface GetAllAccessGroupsWithStatusesRef {
  ...
  (dc: DataConnect): QueryRef<GetAllAccessGroupsWithStatusesData, undefined>;
}
export const getAllAccessGroupsWithStatusesRef: GetAllAccessGroupsWithStatusesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAllAccessGroupsWithStatusesRef:
```typescript
const name = getAllAccessGroupsWithStatusesRef.operationName;
console.log(name);
```

### Variables
The `GetAllAccessGroupsWithStatuses` query has no variables.
### Return Type
Recall that executing the `GetAllAccessGroupsWithStatuses` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAllAccessGroupsWithStatusesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAllAccessGroupsWithStatusesData {
  accessGroups: ({
    id: UUIDString;
    name: string;
    membershipStatuses?: MembershipStatus[] | null;
  } & AccessGroup_Key)[];
}
```
### Using `GetAllAccessGroupsWithStatuses`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAllAccessGroupsWithStatuses } from '@dataconnect/generated';


// Call the `getAllAccessGroupsWithStatuses()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAllAccessGroupsWithStatuses();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAllAccessGroupsWithStatuses(dataConnect);

console.log(data.accessGroups);

// Or, you can use the `Promise` API.
getAllAccessGroupsWithStatuses().then((response) => {
  const data = response.data;
  console.log(data.accessGroups);
});
```

### Using `GetAllAccessGroupsWithStatuses`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAllAccessGroupsWithStatusesRef } from '@dataconnect/generated';


// Call the `getAllAccessGroupsWithStatusesRef()` function to get a reference to the query.
const ref = getAllAccessGroupsWithStatusesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAllAccessGroupsWithStatusesRef(dataConnect);

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

## GetSectionMembers
You can execute the `GetSectionMembers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSectionMembers(vars: GetSectionMembersVariables): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;

interface GetSectionMembersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
}
export const getSectionMembersRef: GetSectionMembersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionMembers(dc: DataConnect, vars: GetSectionMembersVariables): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;

interface GetSectionMembersRef {
  ...
  (dc: DataConnect, vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
}
export const getSectionMembersRef: GetSectionMembersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSectionMembersRef:
```typescript
const name = getSectionMembersRef.operationName;
console.log(name);
```

### Variables
The `GetSectionMembers` query requires an argument of type `GetSectionMembersVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSectionMembersVariables {
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `GetSectionMembers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSectionMembersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSectionMembersData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    memberAccessGroups: ({
      accessGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
        users: ({
          user: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            membershipStatus: MembershipStatus;
          } & User_Key;
        })[];
      } & AccessGroup_Key;
    })[];
      viewingAccessGroups: ({
        accessGroup: {
          id: UUIDString;
          name: string;
          membershipStatuses?: MembershipStatus[] | null;
          users: ({
            user: {
              id: string;
              firstName: string;
              lastName: string;
              email: string;
              membershipStatus: MembershipStatus;
            } & User_Key;
          })[];
        } & AccessGroup_Key;
      })[];
  } & Section_Key;
}
```
### Using `GetSectionMembers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSectionMembers, GetSectionMembersVariables } from '@dataconnect/generated';

// The `GetSectionMembers` query requires an argument of type `GetSectionMembersVariables`:
const getSectionMembersVars: GetSectionMembersVariables = {
  sectionId: ..., 
};

// Call the `getSectionMembers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSectionMembers(getSectionMembersVars);
// Variables can be defined inline as well.
const { data } = await getSectionMembers({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSectionMembers(dataConnect, getSectionMembersVars);

console.log(data.section);

// Or, you can use the `Promise` API.
getSectionMembers(getSectionMembersVars).then((response) => {
  const data = response.data;
  console.log(data.section);
});
```

### Using `GetSectionMembers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSectionMembersRef, GetSectionMembersVariables } from '@dataconnect/generated';

// The `GetSectionMembers` query requires an argument of type `GetSectionMembersVariables`:
const getSectionMembersVars: GetSectionMembersVariables = {
  sectionId: ..., 
};

// Call the `getSectionMembersRef()` function to get a reference to the query.
const ref = getSectionMembersRef(getSectionMembersVars);
// Variables can be defined inline as well.
const ref = getSectionMembersRef({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSectionMembersRef(dataConnect, getSectionMembersVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.section);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.section);
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
  membershipStatuses?: MembershipStatus[] | null;
  subscribable?: boolean | null;
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
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `createAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAccessGroup(createAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await createAccessGroup({ name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

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
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `createAccessGroupRef()` function to get a reference to the mutation.
const ref = createAccessGroupRef(createAccessGroupVars);
// Variables can be defined inline as well.
const ref = createAccessGroupRef({ name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

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

## GrantViewAccessGroupToSection
You can execute the `GrantViewAccessGroupToSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
grantViewAccessGroupToSection(vars: GrantViewAccessGroupToSectionVariables): MutationPromise<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;

interface GrantViewAccessGroupToSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantViewAccessGroupToSectionVariables): MutationRef<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;
}
export const grantViewAccessGroupToSectionRef: GrantViewAccessGroupToSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
grantViewAccessGroupToSection(dc: DataConnect, vars: GrantViewAccessGroupToSectionVariables): MutationPromise<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;

interface GrantViewAccessGroupToSectionRef {
  ...
  (dc: DataConnect, vars: GrantViewAccessGroupToSectionVariables): MutationRef<GrantViewAccessGroupToSectionData, GrantViewAccessGroupToSectionVariables>;
}
export const grantViewAccessGroupToSectionRef: GrantViewAccessGroupToSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the grantViewAccessGroupToSectionRef:
```typescript
const name = grantViewAccessGroupToSectionRef.operationName;
console.log(name);
```

### Variables
The `GrantViewAccessGroupToSection` mutation requires an argument of type `GrantViewAccessGroupToSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GrantViewAccessGroupToSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `GrantViewAccessGroupToSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GrantViewAccessGroupToSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GrantViewAccessGroupToSectionData {
  sectionViewAccessGroup_upsert: SectionViewAccessGroup_Key;
}
```
### Using `GrantViewAccessGroupToSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, grantViewAccessGroupToSection, GrantViewAccessGroupToSectionVariables } from '@dataconnect/generated';

// The `GrantViewAccessGroupToSection` mutation requires an argument of type `GrantViewAccessGroupToSectionVariables`:
const grantViewAccessGroupToSectionVars: GrantViewAccessGroupToSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `grantViewAccessGroupToSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await grantViewAccessGroupToSection(grantViewAccessGroupToSectionVars);
// Variables can be defined inline as well.
const { data } = await grantViewAccessGroupToSection({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await grantViewAccessGroupToSection(dataConnect, grantViewAccessGroupToSectionVars);

console.log(data.sectionViewAccessGroup_upsert);

// Or, you can use the `Promise` API.
grantViewAccessGroupToSection(grantViewAccessGroupToSectionVars).then((response) => {
  const data = response.data;
  console.log(data.sectionViewAccessGroup_upsert);
});
```

### Using `GrantViewAccessGroupToSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, grantViewAccessGroupToSectionRef, GrantViewAccessGroupToSectionVariables } from '@dataconnect/generated';

// The `GrantViewAccessGroupToSection` mutation requires an argument of type `GrantViewAccessGroupToSectionVariables`:
const grantViewAccessGroupToSectionVars: GrantViewAccessGroupToSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `grantViewAccessGroupToSectionRef()` function to get a reference to the mutation.
const ref = grantViewAccessGroupToSectionRef(grantViewAccessGroupToSectionVars);
// Variables can be defined inline as well.
const ref = grantViewAccessGroupToSectionRef({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = grantViewAccessGroupToSectionRef(dataConnect, grantViewAccessGroupToSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionViewAccessGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionViewAccessGroup_upsert);
});
```

## RevokeViewAccessGroupFromSection
You can execute the `RevokeViewAccessGroupFromSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
revokeViewAccessGroupFromSection(vars: RevokeViewAccessGroupFromSectionVariables): MutationPromise<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;

interface RevokeViewAccessGroupFromSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeViewAccessGroupFromSectionVariables): MutationRef<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;
}
export const revokeViewAccessGroupFromSectionRef: RevokeViewAccessGroupFromSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
revokeViewAccessGroupFromSection(dc: DataConnect, vars: RevokeViewAccessGroupFromSectionVariables): MutationPromise<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;

interface RevokeViewAccessGroupFromSectionRef {
  ...
  (dc: DataConnect, vars: RevokeViewAccessGroupFromSectionVariables): MutationRef<RevokeViewAccessGroupFromSectionData, RevokeViewAccessGroupFromSectionVariables>;
}
export const revokeViewAccessGroupFromSectionRef: RevokeViewAccessGroupFromSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the revokeViewAccessGroupFromSectionRef:
```typescript
const name = revokeViewAccessGroupFromSectionRef.operationName;
console.log(name);
```

### Variables
The `RevokeViewAccessGroupFromSection` mutation requires an argument of type `RevokeViewAccessGroupFromSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RevokeViewAccessGroupFromSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RevokeViewAccessGroupFromSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RevokeViewAccessGroupFromSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RevokeViewAccessGroupFromSectionData {
  sectionViewAccessGroup_delete?: SectionViewAccessGroup_Key | null;
}
```
### Using `RevokeViewAccessGroupFromSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, revokeViewAccessGroupFromSection, RevokeViewAccessGroupFromSectionVariables } from '@dataconnect/generated';

// The `RevokeViewAccessGroupFromSection` mutation requires an argument of type `RevokeViewAccessGroupFromSectionVariables`:
const revokeViewAccessGroupFromSectionVars: RevokeViewAccessGroupFromSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `revokeViewAccessGroupFromSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await revokeViewAccessGroupFromSection(revokeViewAccessGroupFromSectionVars);
// Variables can be defined inline as well.
const { data } = await revokeViewAccessGroupFromSection({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await revokeViewAccessGroupFromSection(dataConnect, revokeViewAccessGroupFromSectionVars);

console.log(data.sectionViewAccessGroup_delete);

// Or, you can use the `Promise` API.
revokeViewAccessGroupFromSection(revokeViewAccessGroupFromSectionVars).then((response) => {
  const data = response.data;
  console.log(data.sectionViewAccessGroup_delete);
});
```

### Using `RevokeViewAccessGroupFromSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, revokeViewAccessGroupFromSectionRef, RevokeViewAccessGroupFromSectionVariables } from '@dataconnect/generated';

// The `RevokeViewAccessGroupFromSection` mutation requires an argument of type `RevokeViewAccessGroupFromSectionVariables`:
const revokeViewAccessGroupFromSectionVars: RevokeViewAccessGroupFromSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `revokeViewAccessGroupFromSectionRef()` function to get a reference to the mutation.
const ref = revokeViewAccessGroupFromSectionRef(revokeViewAccessGroupFromSectionVars);
// Variables can be defined inline as well.
const ref = revokeViewAccessGroupFromSectionRef({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = revokeViewAccessGroupFromSectionRef(dataConnect, revokeViewAccessGroupFromSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionViewAccessGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionViewAccessGroup_delete);
});
```

## GrantMemberAccessGroupToSection
You can execute the `GrantMemberAccessGroupToSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
grantMemberAccessGroupToSection(vars: GrantMemberAccessGroupToSectionVariables): MutationPromise<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;

interface GrantMemberAccessGroupToSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantMemberAccessGroupToSectionVariables): MutationRef<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;
}
export const grantMemberAccessGroupToSectionRef: GrantMemberAccessGroupToSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
grantMemberAccessGroupToSection(dc: DataConnect, vars: GrantMemberAccessGroupToSectionVariables): MutationPromise<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;

interface GrantMemberAccessGroupToSectionRef {
  ...
  (dc: DataConnect, vars: GrantMemberAccessGroupToSectionVariables): MutationRef<GrantMemberAccessGroupToSectionData, GrantMemberAccessGroupToSectionVariables>;
}
export const grantMemberAccessGroupToSectionRef: GrantMemberAccessGroupToSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the grantMemberAccessGroupToSectionRef:
```typescript
const name = grantMemberAccessGroupToSectionRef.operationName;
console.log(name);
```

### Variables
The `GrantMemberAccessGroupToSection` mutation requires an argument of type `GrantMemberAccessGroupToSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GrantMemberAccessGroupToSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `GrantMemberAccessGroupToSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GrantMemberAccessGroupToSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GrantMemberAccessGroupToSectionData {
  sectionMemberAccessGroup_upsert: SectionMemberAccessGroup_Key;
}
```
### Using `GrantMemberAccessGroupToSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, grantMemberAccessGroupToSection, GrantMemberAccessGroupToSectionVariables } from '@dataconnect/generated';

// The `GrantMemberAccessGroupToSection` mutation requires an argument of type `GrantMemberAccessGroupToSectionVariables`:
const grantMemberAccessGroupToSectionVars: GrantMemberAccessGroupToSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `grantMemberAccessGroupToSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await grantMemberAccessGroupToSection(grantMemberAccessGroupToSectionVars);
// Variables can be defined inline as well.
const { data } = await grantMemberAccessGroupToSection({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await grantMemberAccessGroupToSection(dataConnect, grantMemberAccessGroupToSectionVars);

console.log(data.sectionMemberAccessGroup_upsert);

// Or, you can use the `Promise` API.
grantMemberAccessGroupToSection(grantMemberAccessGroupToSectionVars).then((response) => {
  const data = response.data;
  console.log(data.sectionMemberAccessGroup_upsert);
});
```

### Using `GrantMemberAccessGroupToSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, grantMemberAccessGroupToSectionRef, GrantMemberAccessGroupToSectionVariables } from '@dataconnect/generated';

// The `GrantMemberAccessGroupToSection` mutation requires an argument of type `GrantMemberAccessGroupToSectionVariables`:
const grantMemberAccessGroupToSectionVars: GrantMemberAccessGroupToSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `grantMemberAccessGroupToSectionRef()` function to get a reference to the mutation.
const ref = grantMemberAccessGroupToSectionRef(grantMemberAccessGroupToSectionVars);
// Variables can be defined inline as well.
const ref = grantMemberAccessGroupToSectionRef({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = grantMemberAccessGroupToSectionRef(dataConnect, grantMemberAccessGroupToSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionMemberAccessGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionMemberAccessGroup_upsert);
});
```

## RevokeMemberAccessGroupFromSection
You can execute the `RevokeMemberAccessGroupFromSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
revokeMemberAccessGroupFromSection(vars: RevokeMemberAccessGroupFromSectionVariables): MutationPromise<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;

interface RevokeMemberAccessGroupFromSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeMemberAccessGroupFromSectionVariables): MutationRef<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;
}
export const revokeMemberAccessGroupFromSectionRef: RevokeMemberAccessGroupFromSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
revokeMemberAccessGroupFromSection(dc: DataConnect, vars: RevokeMemberAccessGroupFromSectionVariables): MutationPromise<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;

interface RevokeMemberAccessGroupFromSectionRef {
  ...
  (dc: DataConnect, vars: RevokeMemberAccessGroupFromSectionVariables): MutationRef<RevokeMemberAccessGroupFromSectionData, RevokeMemberAccessGroupFromSectionVariables>;
}
export const revokeMemberAccessGroupFromSectionRef: RevokeMemberAccessGroupFromSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the revokeMemberAccessGroupFromSectionRef:
```typescript
const name = revokeMemberAccessGroupFromSectionRef.operationName;
console.log(name);
```

### Variables
The `RevokeMemberAccessGroupFromSection` mutation requires an argument of type `RevokeMemberAccessGroupFromSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RevokeMemberAccessGroupFromSectionVariables {
  sectionId: UUIDString;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RevokeMemberAccessGroupFromSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RevokeMemberAccessGroupFromSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RevokeMemberAccessGroupFromSectionData {
  sectionMemberAccessGroup_delete?: SectionMemberAccessGroup_Key | null;
}
```
### Using `RevokeMemberAccessGroupFromSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, revokeMemberAccessGroupFromSection, RevokeMemberAccessGroupFromSectionVariables } from '@dataconnect/generated';

// The `RevokeMemberAccessGroupFromSection` mutation requires an argument of type `RevokeMemberAccessGroupFromSectionVariables`:
const revokeMemberAccessGroupFromSectionVars: RevokeMemberAccessGroupFromSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `revokeMemberAccessGroupFromSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await revokeMemberAccessGroupFromSection(revokeMemberAccessGroupFromSectionVars);
// Variables can be defined inline as well.
const { data } = await revokeMemberAccessGroupFromSection({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await revokeMemberAccessGroupFromSection(dataConnect, revokeMemberAccessGroupFromSectionVars);

console.log(data.sectionMemberAccessGroup_delete);

// Or, you can use the `Promise` API.
revokeMemberAccessGroupFromSection(revokeMemberAccessGroupFromSectionVars).then((response) => {
  const data = response.data;
  console.log(data.sectionMemberAccessGroup_delete);
});
```

### Using `RevokeMemberAccessGroupFromSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, revokeMemberAccessGroupFromSectionRef, RevokeMemberAccessGroupFromSectionVariables } from '@dataconnect/generated';

// The `RevokeMemberAccessGroupFromSection` mutation requires an argument of type `RevokeMemberAccessGroupFromSectionVariables`:
const revokeMemberAccessGroupFromSectionVars: RevokeMemberAccessGroupFromSectionVariables = {
  sectionId: ..., 
  accessGroupId: ..., 
};

// Call the `revokeMemberAccessGroupFromSectionRef()` function to get a reference to the mutation.
const ref = revokeMemberAccessGroupFromSectionRef(revokeMemberAccessGroupFromSectionVars);
// Variables can be defined inline as well.
const ref = revokeMemberAccessGroupFromSectionRef({ sectionId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = revokeMemberAccessGroupFromSectionRef(dataConnect, revokeMemberAccessGroupFromSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionMemberAccessGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionMemberAccessGroup_delete);
});
```

## UpdateAccessGroup
You can execute the `UpdateAccessGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAccessGroup(vars: UpdateAccessGroupVariables): MutationPromise<UpdateAccessGroupData, UpdateAccessGroupVariables>;

interface UpdateAccessGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccessGroupVariables): MutationRef<UpdateAccessGroupData, UpdateAccessGroupVariables>;
}
export const updateAccessGroupRef: UpdateAccessGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAccessGroup(dc: DataConnect, vars: UpdateAccessGroupVariables): MutationPromise<UpdateAccessGroupData, UpdateAccessGroupVariables>;

interface UpdateAccessGroupRef {
  ...
  (dc: DataConnect, vars: UpdateAccessGroupVariables): MutationRef<UpdateAccessGroupData, UpdateAccessGroupVariables>;
}
export const updateAccessGroupRef: UpdateAccessGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAccessGroupRef:
```typescript
const name = updateAccessGroupRef.operationName;
console.log(name);
```

### Variables
The `UpdateAccessGroup` mutation requires an argument of type `UpdateAccessGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateAccessGroupVariables {
  id: UUIDString;
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
  subscribable?: boolean | null;
}
```
### Return Type
Recall that executing the `UpdateAccessGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAccessGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAccessGroupData {
  accessGroup_update?: AccessGroup_Key | null;
}
```
### Using `UpdateAccessGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAccessGroup, UpdateAccessGroupVariables } from '@dataconnect/generated';

// The `UpdateAccessGroup` mutation requires an argument of type `UpdateAccessGroupVariables`:
const updateAccessGroupVars: UpdateAccessGroupVariables = {
  id: ..., 
  name: ..., 
  description: ..., // optional
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `updateAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAccessGroup(updateAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await updateAccessGroup({ id: ..., name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAccessGroup(dataConnect, updateAccessGroupVars);

console.log(data.accessGroup_update);

// Or, you can use the `Promise` API.
updateAccessGroup(updateAccessGroupVars).then((response) => {
  const data = response.data;
  console.log(data.accessGroup_update);
});
```

### Using `UpdateAccessGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAccessGroupRef, UpdateAccessGroupVariables } from '@dataconnect/generated';

// The `UpdateAccessGroup` mutation requires an argument of type `UpdateAccessGroupVariables`:
const updateAccessGroupVars: UpdateAccessGroupVariables = {
  id: ..., 
  name: ..., 
  description: ..., // optional
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `updateAccessGroupRef()` function to get a reference to the mutation.
const ref = updateAccessGroupRef(updateAccessGroupVars);
// Variables can be defined inline as well.
const ref = updateAccessGroupRef({ id: ..., name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAccessGroupRef(dataConnect, updateAccessGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accessGroup_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accessGroup_update);
});
```

## DeleteAccessGroup
You can execute the `DeleteAccessGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteAccessGroup(vars: DeleteAccessGroupVariables): MutationPromise<DeleteAccessGroupData, DeleteAccessGroupVariables>;

interface DeleteAccessGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccessGroupVariables): MutationRef<DeleteAccessGroupData, DeleteAccessGroupVariables>;
}
export const deleteAccessGroupRef: DeleteAccessGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteAccessGroup(dc: DataConnect, vars: DeleteAccessGroupVariables): MutationPromise<DeleteAccessGroupData, DeleteAccessGroupVariables>;

interface DeleteAccessGroupRef {
  ...
  (dc: DataConnect, vars: DeleteAccessGroupVariables): MutationRef<DeleteAccessGroupData, DeleteAccessGroupVariables>;
}
export const deleteAccessGroupRef: DeleteAccessGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteAccessGroupRef:
```typescript
const name = deleteAccessGroupRef.operationName;
console.log(name);
```

### Variables
The `DeleteAccessGroup` mutation requires an argument of type `DeleteAccessGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteAccessGroupVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteAccessGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteAccessGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteAccessGroupData {
  accessGroup_delete?: AccessGroup_Key | null;
}
```
### Using `DeleteAccessGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteAccessGroup, DeleteAccessGroupVariables } from '@dataconnect/generated';

// The `DeleteAccessGroup` mutation requires an argument of type `DeleteAccessGroupVariables`:
const deleteAccessGroupVars: DeleteAccessGroupVariables = {
  id: ..., 
};

// Call the `deleteAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteAccessGroup(deleteAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await deleteAccessGroup({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteAccessGroup(dataConnect, deleteAccessGroupVars);

console.log(data.accessGroup_delete);

// Or, you can use the `Promise` API.
deleteAccessGroup(deleteAccessGroupVars).then((response) => {
  const data = response.data;
  console.log(data.accessGroup_delete);
});
```

### Using `DeleteAccessGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteAccessGroupRef, DeleteAccessGroupVariables } from '@dataconnect/generated';

// The `DeleteAccessGroup` mutation requires an argument of type `DeleteAccessGroupVariables`:
const deleteAccessGroupVars: DeleteAccessGroupVariables = {
  id: ..., 
};

// Call the `deleteAccessGroupRef()` function to get a reference to the mutation.
const ref = deleteAccessGroupRef(deleteAccessGroupVars);
// Variables can be defined inline as well.
const ref = deleteAccessGroupRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteAccessGroupRef(dataConnect, deleteAccessGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accessGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accessGroup_delete);
});
```

## UpdateSection
You can execute the `UpdateSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSection(vars: UpdateSectionVariables): MutationPromise<UpdateSectionData, UpdateSectionVariables>;

interface UpdateSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSectionVariables): MutationRef<UpdateSectionData, UpdateSectionVariables>;
}
export const updateSectionRef: UpdateSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSection(dc: DataConnect, vars: UpdateSectionVariables): MutationPromise<UpdateSectionData, UpdateSectionVariables>;

interface UpdateSectionRef {
  ...
  (dc: DataConnect, vars: UpdateSectionVariables): MutationRef<UpdateSectionData, UpdateSectionVariables>;
}
export const updateSectionRef: UpdateSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSectionRef:
```typescript
const name = updateSectionRef.operationName;
console.log(name);
```

### Variables
The `UpdateSection` mutation requires an argument of type `UpdateSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateSectionVariables {
  id: UUIDString;
  name: string;
  description?: string | null;
}
```
### Return Type
Recall that executing the `UpdateSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSectionData {
  section_update?: Section_Key | null;
}
```
### Using `UpdateSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSection, UpdateSectionVariables } from '@dataconnect/generated';

// The `UpdateSection` mutation requires an argument of type `UpdateSectionVariables`:
const updateSectionVars: UpdateSectionVariables = {
  id: ..., 
  name: ..., 
  description: ..., // optional
};

// Call the `updateSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSection(updateSectionVars);
// Variables can be defined inline as well.
const { data } = await updateSection({ id: ..., name: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSection(dataConnect, updateSectionVars);

console.log(data.section_update);

// Or, you can use the `Promise` API.
updateSection(updateSectionVars).then((response) => {
  const data = response.data;
  console.log(data.section_update);
});
```

### Using `UpdateSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSectionRef, UpdateSectionVariables } from '@dataconnect/generated';

// The `UpdateSection` mutation requires an argument of type `UpdateSectionVariables`:
const updateSectionVars: UpdateSectionVariables = {
  id: ..., 
  name: ..., 
  description: ..., // optional
};

// Call the `updateSectionRef()` function to get a reference to the mutation.
const ref = updateSectionRef(updateSectionVars);
// Variables can be defined inline as well.
const ref = updateSectionRef({ id: ..., name: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSectionRef(dataConnect, updateSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.section_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.section_update);
});
```

## DeleteSection
You can execute the `DeleteSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteSection(vars: DeleteSectionVariables): MutationPromise<DeleteSectionData, DeleteSectionVariables>;

interface DeleteSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSectionVariables): MutationRef<DeleteSectionData, DeleteSectionVariables>;
}
export const deleteSectionRef: DeleteSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteSection(dc: DataConnect, vars: DeleteSectionVariables): MutationPromise<DeleteSectionData, DeleteSectionVariables>;

interface DeleteSectionRef {
  ...
  (dc: DataConnect, vars: DeleteSectionVariables): MutationRef<DeleteSectionData, DeleteSectionVariables>;
}
export const deleteSectionRef: DeleteSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteSectionRef:
```typescript
const name = deleteSectionRef.operationName;
console.log(name);
```

### Variables
The `DeleteSection` mutation requires an argument of type `DeleteSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteSectionVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteSectionData {
  section_delete?: Section_Key | null;
}
```
### Using `DeleteSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteSection, DeleteSectionVariables } from '@dataconnect/generated';

// The `DeleteSection` mutation requires an argument of type `DeleteSectionVariables`:
const deleteSectionVars: DeleteSectionVariables = {
  id: ..., 
};

// Call the `deleteSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteSection(deleteSectionVars);
// Variables can be defined inline as well.
const { data } = await deleteSection({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteSection(dataConnect, deleteSectionVars);

console.log(data.section_delete);

// Or, you can use the `Promise` API.
deleteSection(deleteSectionVars).then((response) => {
  const data = response.data;
  console.log(data.section_delete);
});
```

### Using `DeleteSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteSectionRef, DeleteSectionVariables } from '@dataconnect/generated';

// The `DeleteSection` mutation requires an argument of type `DeleteSectionVariables`:
const deleteSectionVars: DeleteSectionVariables = {
  id: ..., 
};

// Call the `deleteSectionRef()` function to get a reference to the mutation.
const ref = deleteSectionRef(deleteSectionVars);
// Variables can be defined inline as well.
const ref = deleteSectionRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteSectionRef(dataConnect, deleteSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.section_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.section_delete);
});
```

## UpdateUserMembershipStatus
You can execute the `UpdateUserMembershipStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUserMembershipStatus(vars: UpdateUserMembershipStatusVariables): MutationPromise<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;

interface UpdateUserMembershipStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserMembershipStatusVariables): MutationRef<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
}
export const updateUserMembershipStatusRef: UpdateUserMembershipStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUserMembershipStatus(dc: DataConnect, vars: UpdateUserMembershipStatusVariables): MutationPromise<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;

interface UpdateUserMembershipStatusRef {
  ...
  (dc: DataConnect, vars: UpdateUserMembershipStatusVariables): MutationRef<UpdateUserMembershipStatusData, UpdateUserMembershipStatusVariables>;
}
export const updateUserMembershipStatusRef: UpdateUserMembershipStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserMembershipStatusRef:
```typescript
const name = updateUserMembershipStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateUserMembershipStatus` mutation requires an argument of type `UpdateUserMembershipStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserMembershipStatusVariables {
  userId: string;
  membershipStatus: MembershipStatus;
}
```
### Return Type
Recall that executing the `UpdateUserMembershipStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserMembershipStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserMembershipStatusData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUserMembershipStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUserMembershipStatus, UpdateUserMembershipStatusVariables } from '@dataconnect/generated';

// The `UpdateUserMembershipStatus` mutation requires an argument of type `UpdateUserMembershipStatusVariables`:
const updateUserMembershipStatusVars: UpdateUserMembershipStatusVariables = {
  userId: ..., 
  membershipStatus: ..., 
};

// Call the `updateUserMembershipStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUserMembershipStatus(updateUserMembershipStatusVars);
// Variables can be defined inline as well.
const { data } = await updateUserMembershipStatus({ userId: ..., membershipStatus: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUserMembershipStatus(dataConnect, updateUserMembershipStatusVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUserMembershipStatus(updateUserMembershipStatusVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUserMembershipStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserMembershipStatusRef, UpdateUserMembershipStatusVariables } from '@dataconnect/generated';

// The `UpdateUserMembershipStatus` mutation requires an argument of type `UpdateUserMembershipStatusVariables`:
const updateUserMembershipStatusVars: UpdateUserMembershipStatusVariables = {
  userId: ..., 
  membershipStatus: ..., 
};

// Call the `updateUserMembershipStatusRef()` function to get a reference to the mutation.
const ref = updateUserMembershipStatusRef(updateUserMembershipStatusVars);
// Variables can be defined inline as well.
const ref = updateUserMembershipStatusRef({ userId: ..., membershipStatus: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserMembershipStatusRef(dataConnect, updateUserMembershipStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## DeleteUser
You can execute the `DeleteUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteUser(vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;

interface DeleteUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
}
export const deleteUserRef: DeleteUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteUser(dc: DataConnect, vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;

interface DeleteUserRef {
  ...
  (dc: DataConnect, vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
}
export const deleteUserRef: DeleteUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteUserRef:
```typescript
const name = deleteUserRef.operationName;
console.log(name);
```

### Variables
The `DeleteUser` mutation requires an argument of type `DeleteUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteUserVariables {
  userId: string;
}
```
### Return Type
Recall that executing the `DeleteUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteUserData {
  user_delete?: User_Key | null;
}
```
### Using `DeleteUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteUser, DeleteUserVariables } from '@dataconnect/generated';

// The `DeleteUser` mutation requires an argument of type `DeleteUserVariables`:
const deleteUserVars: DeleteUserVariables = {
  userId: ..., 
};

// Call the `deleteUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteUser(deleteUserVars);
// Variables can be defined inline as well.
const { data } = await deleteUser({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteUser(dataConnect, deleteUserVars);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
deleteUser(deleteUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

### Using `DeleteUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteUserRef, DeleteUserVariables } from '@dataconnect/generated';

// The `DeleteUser` mutation requires an argument of type `DeleteUserVariables`:
const deleteUserVars: DeleteUserVariables = {
  userId: ..., 
};

// Call the `deleteUserRef()` function to get a reference to the mutation.
const ref = deleteUserRef(deleteUserVars);
// Variables can be defined inline as well.
const ref = deleteUserRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteUserRef(dataConnect, deleteUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus: MembershipStatus;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_upsert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  userId: ..., 
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  membershipStatus: ..., 
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
  now: ..., 
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ userId: ..., firstName: ..., lastName: ..., email: ..., serviceNumber: ..., membershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  userId: ..., 
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  membershipStatus: ..., 
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
  now: ..., 
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ userId: ..., firstName: ..., lastName: ..., email: ..., serviceNumber: ..., membershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

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

## CreateAccessGroupAdmin
You can execute the `CreateAccessGroupAdmin` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAccessGroupAdmin(vars: CreateAccessGroupAdminVariables): MutationPromise<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;

interface CreateAccessGroupAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccessGroupAdminVariables): MutationRef<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;
}
export const createAccessGroupAdminRef: CreateAccessGroupAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAccessGroupAdmin(dc: DataConnect, vars: CreateAccessGroupAdminVariables): MutationPromise<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;

interface CreateAccessGroupAdminRef {
  ...
  (dc: DataConnect, vars: CreateAccessGroupAdminVariables): MutationRef<CreateAccessGroupAdminData, CreateAccessGroupAdminVariables>;
}
export const createAccessGroupAdminRef: CreateAccessGroupAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAccessGroupAdminRef:
```typescript
const name = createAccessGroupAdminRef.operationName;
console.log(name);
```

### Variables
The `CreateAccessGroupAdmin` mutation requires an argument of type `CreateAccessGroupAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAccessGroupAdminVariables {
  name: string;
  description?: string | null;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `CreateAccessGroupAdmin` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAccessGroupAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAccessGroupAdminData {
  accessGroup_insert: AccessGroup_Key;
}
```
### Using `CreateAccessGroupAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAccessGroupAdmin, CreateAccessGroupAdminVariables } from '@dataconnect/generated';

// The `CreateAccessGroupAdmin` mutation requires an argument of type `CreateAccessGroupAdminVariables`:
const createAccessGroupAdminVars: CreateAccessGroupAdminVariables = {
  name: ..., 
  description: ..., // optional
  now: ..., 
};

// Call the `createAccessGroupAdmin()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAccessGroupAdmin(createAccessGroupAdminVars);
// Variables can be defined inline as well.
const { data } = await createAccessGroupAdmin({ name: ..., description: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAccessGroupAdmin(dataConnect, createAccessGroupAdminVars);

console.log(data.accessGroup_insert);

// Or, you can use the `Promise` API.
createAccessGroupAdmin(createAccessGroupAdminVars).then((response) => {
  const data = response.data;
  console.log(data.accessGroup_insert);
});
```

### Using `CreateAccessGroupAdmin`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAccessGroupAdminRef, CreateAccessGroupAdminVariables } from '@dataconnect/generated';

// The `CreateAccessGroupAdmin` mutation requires an argument of type `CreateAccessGroupAdminVariables`:
const createAccessGroupAdminVars: CreateAccessGroupAdminVariables = {
  name: ..., 
  description: ..., // optional
  now: ..., 
};

// Call the `createAccessGroupAdminRef()` function to get a reference to the mutation.
const ref = createAccessGroupAdminRef(createAccessGroupAdminVars);
// Variables can be defined inline as well.
const ref = createAccessGroupAdminRef({ name: ..., description: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAccessGroupAdminRef(dataConnect, createAccessGroupAdminVars);

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

## AddUserToAccessGroupAdmin
You can execute the `AddUserToAccessGroupAdmin` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addUserToAccessGroupAdmin(vars: AddUserToAccessGroupAdminVariables): MutationPromise<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;

interface AddUserToAccessGroupAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToAccessGroupAdminVariables): MutationRef<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;
}
export const addUserToAccessGroupAdminRef: AddUserToAccessGroupAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addUserToAccessGroupAdmin(dc: DataConnect, vars: AddUserToAccessGroupAdminVariables): MutationPromise<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;

interface AddUserToAccessGroupAdminRef {
  ...
  (dc: DataConnect, vars: AddUserToAccessGroupAdminVariables): MutationRef<AddUserToAccessGroupAdminData, AddUserToAccessGroupAdminVariables>;
}
export const addUserToAccessGroupAdminRef: AddUserToAccessGroupAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addUserToAccessGroupAdminRef:
```typescript
const name = addUserToAccessGroupAdminRef.operationName;
console.log(name);
```

### Variables
The `AddUserToAccessGroupAdmin` mutation requires an argument of type `AddUserToAccessGroupAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddUserToAccessGroupAdminVariables {
  userId: string;
  accessGroupId: UUIDString;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `AddUserToAccessGroupAdmin` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddUserToAccessGroupAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddUserToAccessGroupAdminData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}
```
### Using `AddUserToAccessGroupAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addUserToAccessGroupAdmin, AddUserToAccessGroupAdminVariables } from '@dataconnect/generated';

// The `AddUserToAccessGroupAdmin` mutation requires an argument of type `AddUserToAccessGroupAdminVariables`:
const addUserToAccessGroupAdminVars: AddUserToAccessGroupAdminVariables = {
  userId: ..., 
  accessGroupId: ..., 
  now: ..., 
};

// Call the `addUserToAccessGroupAdmin()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addUserToAccessGroupAdmin(addUserToAccessGroupAdminVars);
// Variables can be defined inline as well.
const { data } = await addUserToAccessGroupAdmin({ userId: ..., accessGroupId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addUserToAccessGroupAdmin(dataConnect, addUserToAccessGroupAdminVars);

console.log(data.userAccessGroup_upsert);

// Or, you can use the `Promise` API.
addUserToAccessGroupAdmin(addUserToAccessGroupAdminVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_upsert);
});
```

### Using `AddUserToAccessGroupAdmin`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addUserToAccessGroupAdminRef, AddUserToAccessGroupAdminVariables } from '@dataconnect/generated';

// The `AddUserToAccessGroupAdmin` mutation requires an argument of type `AddUserToAccessGroupAdminVariables`:
const addUserToAccessGroupAdminVars: AddUserToAccessGroupAdminVariables = {
  userId: ..., 
  accessGroupId: ..., 
  now: ..., 
};

// Call the `addUserToAccessGroupAdminRef()` function to get a reference to the mutation.
const ref = addUserToAccessGroupAdminRef(addUserToAccessGroupAdminVars);
// Variables can be defined inline as well.
const ref = addUserToAccessGroupAdminRef({ userId: ..., accessGroupId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addUserToAccessGroupAdminRef(dataConnect, addUserToAccessGroupAdminVars);

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

## RemoveUserFromAccessGroupAdmin
You can execute the `RemoveUserFromAccessGroupAdmin` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeUserFromAccessGroupAdmin(vars: RemoveUserFromAccessGroupAdminVariables): MutationPromise<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;

interface RemoveUserFromAccessGroupAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromAccessGroupAdminVariables): MutationRef<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;
}
export const removeUserFromAccessGroupAdminRef: RemoveUserFromAccessGroupAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeUserFromAccessGroupAdmin(dc: DataConnect, vars: RemoveUserFromAccessGroupAdminVariables): MutationPromise<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;

interface RemoveUserFromAccessGroupAdminRef {
  ...
  (dc: DataConnect, vars: RemoveUserFromAccessGroupAdminVariables): MutationRef<RemoveUserFromAccessGroupAdminData, RemoveUserFromAccessGroupAdminVariables>;
}
export const removeUserFromAccessGroupAdminRef: RemoveUserFromAccessGroupAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeUserFromAccessGroupAdminRef:
```typescript
const name = removeUserFromAccessGroupAdminRef.operationName;
console.log(name);
```

### Variables
The `RemoveUserFromAccessGroupAdmin` mutation requires an argument of type `RemoveUserFromAccessGroupAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveUserFromAccessGroupAdminVariables {
  userId: string;
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RemoveUserFromAccessGroupAdmin` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveUserFromAccessGroupAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveUserFromAccessGroupAdminData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}
```
### Using `RemoveUserFromAccessGroupAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeUserFromAccessGroupAdmin, RemoveUserFromAccessGroupAdminVariables } from '@dataconnect/generated';

// The `RemoveUserFromAccessGroupAdmin` mutation requires an argument of type `RemoveUserFromAccessGroupAdminVariables`:
const removeUserFromAccessGroupAdminVars: RemoveUserFromAccessGroupAdminVariables = {
  userId: ..., 
  accessGroupId: ..., 
};

// Call the `removeUserFromAccessGroupAdmin()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeUserFromAccessGroupAdmin(removeUserFromAccessGroupAdminVars);
// Variables can be defined inline as well.
const { data } = await removeUserFromAccessGroupAdmin({ userId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeUserFromAccessGroupAdmin(dataConnect, removeUserFromAccessGroupAdminVars);

console.log(data.userAccessGroup_delete);

// Or, you can use the `Promise` API.
removeUserFromAccessGroupAdmin(removeUserFromAccessGroupAdminVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_delete);
});
```

### Using `RemoveUserFromAccessGroupAdmin`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeUserFromAccessGroupAdminRef, RemoveUserFromAccessGroupAdminVariables } from '@dataconnect/generated';

// The `RemoveUserFromAccessGroupAdmin` mutation requires an argument of type `RemoveUserFromAccessGroupAdminVariables`:
const removeUserFromAccessGroupAdminVars: RemoveUserFromAccessGroupAdminVariables = {
  userId: ..., 
  accessGroupId: ..., 
};

// Call the `removeUserFromAccessGroupAdminRef()` function to get a reference to the mutation.
const ref = removeUserFromAccessGroupAdminRef(removeUserFromAccessGroupAdminVars);
// Variables can be defined inline as well.
const ref = removeUserFromAccessGroupAdminRef({ userId: ..., accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeUserFromAccessGroupAdminRef(dataConnect, removeUserFromAccessGroupAdminVars);

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

## CreateUserProfile
You can execute the `CreateUserProfile` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUserProfile(vars: CreateUserProfileVariables): MutationPromise<CreateUserProfileData, CreateUserProfileVariables>;

interface CreateUserProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserProfileVariables): MutationRef<CreateUserProfileData, CreateUserProfileVariables>;
}
export const createUserProfileRef: CreateUserProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUserProfile(dc: DataConnect, vars: CreateUserProfileVariables): MutationPromise<CreateUserProfileData, CreateUserProfileVariables>;

interface CreateUserProfileRef {
  ...
  (dc: DataConnect, vars: CreateUserProfileVariables): MutationRef<CreateUserProfileData, CreateUserProfileVariables>;
}
export const createUserProfileRef: CreateUserProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserProfileRef:
```typescript
const name = createUserProfileRef.operationName;
console.log(name);
```

### Variables
The `CreateUserProfile` mutation requires an argument of type `CreateUserProfileVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserProfileVariables {
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  requestedMembershipStatus: MembershipStatus;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}
```
### Return Type
Recall that executing the `CreateUserProfile` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserProfileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserProfileData {
  user_upsert: User_Key;
}
```
### Using `CreateUserProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUserProfile, CreateUserProfileVariables } from '@dataconnect/generated';

// The `CreateUserProfile` mutation requires an argument of type `CreateUserProfileVariables`:
const createUserProfileVars: CreateUserProfileVariables = {
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  requestedMembershipStatus: ..., 
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `createUserProfile()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUserProfile(createUserProfileVars);
// Variables can be defined inline as well.
const { data } = await createUserProfile({ firstName: ..., lastName: ..., email: ..., serviceNumber: ..., requestedMembershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUserProfile(dataConnect, createUserProfileVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
createUserProfile(createUserProfileVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `CreateUserProfile`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserProfileRef, CreateUserProfileVariables } from '@dataconnect/generated';

// The `CreateUserProfile` mutation requires an argument of type `CreateUserProfileVariables`:
const createUserProfileVars: CreateUserProfileVariables = {
  firstName: ..., 
  lastName: ..., 
  email: ..., 
  serviceNumber: ..., 
  requestedMembershipStatus: ..., 
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `createUserProfileRef()` function to get a reference to the mutation.
const ref = createUserProfileRef(createUserProfileVars);
// Variables can be defined inline as well.
const ref = createUserProfileRef({ firstName: ..., lastName: ..., email: ..., serviceNumber: ..., requestedMembershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserProfileRef(dataConnect, createUserProfileVars);

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
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `upsertUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertUser(upsertUserVars);
// Variables can be defined inline as well.
const { data } = await upsertUser({ firstName: ..., lastName: ..., email: ..., serviceNumber: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `upsertUserRef()` function to get a reference to the mutation.
const ref = upsertUserRef(upsertUserVars);
// Variables can be defined inline as well.
const ref = upsertUserRef({ firstName: ..., lastName: ..., email: ..., serviceNumber: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `updateUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUser(updateUserVars);
// Variables can be defined inline as well.
const { data } = await updateUser({ userId: ..., firstName: ..., lastName: ..., email: ..., serviceNumber: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `updateUserRef()` function to get a reference to the mutation.
const ref = updateUserRef(updateUserVars);
// Variables can be defined inline as well.
const ref = updateUserRef({ userId: ..., firstName: ..., lastName: ..., email: ..., serviceNumber: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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

## RegisterForSection
You can execute the `RegisterForSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
registerForSection(vars: RegisterForSectionVariables): MutationPromise<RegisterForSectionData, RegisterForSectionVariables>;

interface RegisterForSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RegisterForSectionVariables): MutationRef<RegisterForSectionData, RegisterForSectionVariables>;
}
export const registerForSectionRef: RegisterForSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
registerForSection(dc: DataConnect, vars: RegisterForSectionVariables): MutationPromise<RegisterForSectionData, RegisterForSectionVariables>;

interface RegisterForSectionRef {
  ...
  (dc: DataConnect, vars: RegisterForSectionVariables): MutationRef<RegisterForSectionData, RegisterForSectionVariables>;
}
export const registerForSectionRef: RegisterForSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the registerForSectionRef:
```typescript
const name = registerForSectionRef.operationName;
console.log(name);
```

### Variables
The `RegisterForSection` mutation requires an argument of type `RegisterForSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RegisterForSectionVariables {
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RegisterForSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RegisterForSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RegisterForSectionData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}
```
### Using `RegisterForSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, registerForSection, RegisterForSectionVariables } from '@dataconnect/generated';

// The `RegisterForSection` mutation requires an argument of type `RegisterForSectionVariables`:
const registerForSectionVars: RegisterForSectionVariables = {
  accessGroupId: ..., 
};

// Call the `registerForSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await registerForSection(registerForSectionVars);
// Variables can be defined inline as well.
const { data } = await registerForSection({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await registerForSection(dataConnect, registerForSectionVars);

console.log(data.userAccessGroup_upsert);

// Or, you can use the `Promise` API.
registerForSection(registerForSectionVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_upsert);
});
```

### Using `RegisterForSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, registerForSectionRef, RegisterForSectionVariables } from '@dataconnect/generated';

// The `RegisterForSection` mutation requires an argument of type `RegisterForSectionVariables`:
const registerForSectionVars: RegisterForSectionVariables = {
  accessGroupId: ..., 
};

// Call the `registerForSectionRef()` function to get a reference to the mutation.
const ref = registerForSectionRef(registerForSectionVars);
// Variables can be defined inline as well.
const ref = registerForSectionRef({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = registerForSectionRef(dataConnect, registerForSectionVars);

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

## UnregisterFromSection
You can execute the `UnregisterFromSection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
unregisterFromSection(vars: UnregisterFromSectionVariables): MutationPromise<UnregisterFromSectionData, UnregisterFromSectionVariables>;

interface UnregisterFromSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnregisterFromSectionVariables): MutationRef<UnregisterFromSectionData, UnregisterFromSectionVariables>;
}
export const unregisterFromSectionRef: UnregisterFromSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
unregisterFromSection(dc: DataConnect, vars: UnregisterFromSectionVariables): MutationPromise<UnregisterFromSectionData, UnregisterFromSectionVariables>;

interface UnregisterFromSectionRef {
  ...
  (dc: DataConnect, vars: UnregisterFromSectionVariables): MutationRef<UnregisterFromSectionData, UnregisterFromSectionVariables>;
}
export const unregisterFromSectionRef: UnregisterFromSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the unregisterFromSectionRef:
```typescript
const name = unregisterFromSectionRef.operationName;
console.log(name);
```

### Variables
The `UnregisterFromSection` mutation requires an argument of type `UnregisterFromSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UnregisterFromSectionVariables {
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `UnregisterFromSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UnregisterFromSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UnregisterFromSectionData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}
```
### Using `UnregisterFromSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, unregisterFromSection, UnregisterFromSectionVariables } from '@dataconnect/generated';

// The `UnregisterFromSection` mutation requires an argument of type `UnregisterFromSectionVariables`:
const unregisterFromSectionVars: UnregisterFromSectionVariables = {
  accessGroupId: ..., 
};

// Call the `unregisterFromSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await unregisterFromSection(unregisterFromSectionVars);
// Variables can be defined inline as well.
const { data } = await unregisterFromSection({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await unregisterFromSection(dataConnect, unregisterFromSectionVars);

console.log(data.userAccessGroup_delete);

// Or, you can use the `Promise` API.
unregisterFromSection(unregisterFromSectionVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_delete);
});
```

### Using `UnregisterFromSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, unregisterFromSectionRef, UnregisterFromSectionVariables } from '@dataconnect/generated';

// The `UnregisterFromSection` mutation requires an argument of type `UnregisterFromSectionVariables`:
const unregisterFromSectionVars: UnregisterFromSectionVariables = {
  accessGroupId: ..., 
};

// Call the `unregisterFromSectionRef()` function to get a reference to the mutation.
const ref = unregisterFromSectionRef(unregisterFromSectionVars);
// Variables can be defined inline as well.
const ref = unregisterFromSectionRef({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = unregisterFromSectionRef(dataConnect, unregisterFromSectionVars);

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

## SubscribeToAccessGroup
You can execute the `SubscribeToAccessGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
subscribeToAccessGroup(vars: SubscribeToAccessGroupVariables): MutationPromise<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;

interface SubscribeToAccessGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SubscribeToAccessGroupVariables): MutationRef<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;
}
export const subscribeToAccessGroupRef: SubscribeToAccessGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
subscribeToAccessGroup(dc: DataConnect, vars: SubscribeToAccessGroupVariables): MutationPromise<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;

interface SubscribeToAccessGroupRef {
  ...
  (dc: DataConnect, vars: SubscribeToAccessGroupVariables): MutationRef<SubscribeToAccessGroupData, SubscribeToAccessGroupVariables>;
}
export const subscribeToAccessGroupRef: SubscribeToAccessGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the subscribeToAccessGroupRef:
```typescript
const name = subscribeToAccessGroupRef.operationName;
console.log(name);
```

### Variables
The `SubscribeToAccessGroup` mutation requires an argument of type `SubscribeToAccessGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SubscribeToAccessGroupVariables {
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `SubscribeToAccessGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SubscribeToAccessGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SubscribeToAccessGroupData {
  userAccessGroup_upsert: UserAccessGroup_Key;
}
```
### Using `SubscribeToAccessGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, subscribeToAccessGroup, SubscribeToAccessGroupVariables } from '@dataconnect/generated';

// The `SubscribeToAccessGroup` mutation requires an argument of type `SubscribeToAccessGroupVariables`:
const subscribeToAccessGroupVars: SubscribeToAccessGroupVariables = {
  accessGroupId: ..., 
};

// Call the `subscribeToAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await subscribeToAccessGroup(subscribeToAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await subscribeToAccessGroup({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await subscribeToAccessGroup(dataConnect, subscribeToAccessGroupVars);

console.log(data.userAccessGroup_upsert);

// Or, you can use the `Promise` API.
subscribeToAccessGroup(subscribeToAccessGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_upsert);
});
```

### Using `SubscribeToAccessGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, subscribeToAccessGroupRef, SubscribeToAccessGroupVariables } from '@dataconnect/generated';

// The `SubscribeToAccessGroup` mutation requires an argument of type `SubscribeToAccessGroupVariables`:
const subscribeToAccessGroupVars: SubscribeToAccessGroupVariables = {
  accessGroupId: ..., 
};

// Call the `subscribeToAccessGroupRef()` function to get a reference to the mutation.
const ref = subscribeToAccessGroupRef(subscribeToAccessGroupVars);
// Variables can be defined inline as well.
const ref = subscribeToAccessGroupRef({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = subscribeToAccessGroupRef(dataConnect, subscribeToAccessGroupVars);

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

## UnsubscribeFromAccessGroup
You can execute the `UnsubscribeFromAccessGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
unsubscribeFromAccessGroup(vars: UnsubscribeFromAccessGroupVariables): MutationPromise<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;

interface UnsubscribeFromAccessGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnsubscribeFromAccessGroupVariables): MutationRef<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;
}
export const unsubscribeFromAccessGroupRef: UnsubscribeFromAccessGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
unsubscribeFromAccessGroup(dc: DataConnect, vars: UnsubscribeFromAccessGroupVariables): MutationPromise<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;

interface UnsubscribeFromAccessGroupRef {
  ...
  (dc: DataConnect, vars: UnsubscribeFromAccessGroupVariables): MutationRef<UnsubscribeFromAccessGroupData, UnsubscribeFromAccessGroupVariables>;
}
export const unsubscribeFromAccessGroupRef: UnsubscribeFromAccessGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the unsubscribeFromAccessGroupRef:
```typescript
const name = unsubscribeFromAccessGroupRef.operationName;
console.log(name);
```

### Variables
The `UnsubscribeFromAccessGroup` mutation requires an argument of type `UnsubscribeFromAccessGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UnsubscribeFromAccessGroupVariables {
  accessGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `UnsubscribeFromAccessGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UnsubscribeFromAccessGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UnsubscribeFromAccessGroupData {
  userAccessGroup_delete?: UserAccessGroup_Key | null;
}
```
### Using `UnsubscribeFromAccessGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, unsubscribeFromAccessGroup, UnsubscribeFromAccessGroupVariables } from '@dataconnect/generated';

// The `UnsubscribeFromAccessGroup` mutation requires an argument of type `UnsubscribeFromAccessGroupVariables`:
const unsubscribeFromAccessGroupVars: UnsubscribeFromAccessGroupVariables = {
  accessGroupId: ..., 
};

// Call the `unsubscribeFromAccessGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await unsubscribeFromAccessGroup(unsubscribeFromAccessGroupVars);
// Variables can be defined inline as well.
const { data } = await unsubscribeFromAccessGroup({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await unsubscribeFromAccessGroup(dataConnect, unsubscribeFromAccessGroupVars);

console.log(data.userAccessGroup_delete);

// Or, you can use the `Promise` API.
unsubscribeFromAccessGroup(unsubscribeFromAccessGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userAccessGroup_delete);
});
```

### Using `UnsubscribeFromAccessGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, unsubscribeFromAccessGroupRef, UnsubscribeFromAccessGroupVariables } from '@dataconnect/generated';

// The `UnsubscribeFromAccessGroup` mutation requires an argument of type `UnsubscribeFromAccessGroupVariables`:
const unsubscribeFromAccessGroupVars: UnsubscribeFromAccessGroupVariables = {
  accessGroupId: ..., 
};

// Call the `unsubscribeFromAccessGroupRef()` function to get a reference to the mutation.
const ref = unsubscribeFromAccessGroupRef(unsubscribeFromAccessGroupVars);
// Variables can be defined inline as well.
const ref = unsubscribeFromAccessGroupRef({ accessGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = unsubscribeFromAccessGroupRef(dataConnect, unsubscribeFromAccessGroupVars);

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

