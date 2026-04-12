# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `api`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetUserGroupByName*](#getusergroupbyname)
  - [*GetUserUserGroupsForAdmin*](#getuserusergroupsforadmin)
  - [*GetCurrentUser*](#getcurrentuser)
  - [*GetUserById*](#getuserbyid)
  - [*ListUsers*](#listusers)
  - [*ListSections*](#listsections)
  - [*GetSectionsForUser*](#getsectionsforuser)
  - [*ListUserGroups*](#listusergroups)
  - [*GetUserAccessGroups*](#getuseraccessgroups)
  - [*CheckUserProfileExists*](#checkuserprofileexists)
  - [*GetUserMembershipStatus*](#getusermembershipstatus)
  - [*GetUserWithAccessGroups*](#getuserwithaccessgroups)
  - [*GetUserAccessGroupsById*](#getuseraccessgroupsbyid)
  - [*GetEventsForSection*](#geteventsforsection)
  - [*GetEventById*](#geteventbyid)
  - [*GetSectionById*](#getsectionbyid)
  - [*GetUserGroupById*](#getusergroupbyid)
  - [*GetAllUserGroupsWithStatuses*](#getallusergroupswithstatuses)
  - [*GetSectionMembers*](#getsectionmembers)
- [**Mutations**](#mutations)
  - [*UpdateUserMembershipStatus*](#updateusermembershipstatus)
  - [*DeleteUser*](#deleteuser)
  - [*CreateUser*](#createuser)
  - [*CreateUserGroupAdmin*](#createusergroupadmin)
  - [*AddUserToUserGroupAdmin*](#addusertousergroupadmin)
  - [*RemoveUserFromUserGroupAdmin*](#removeuserfromusergroupadmin)
  - [*CreateSection*](#createsection)
  - [*CreateUserGroup*](#createusergroup)
  - [*AddUserToUserGroup*](#addusertousergroup)
  - [*RemoveUserFromUserGroup*](#removeuserfromusergroup)
  - [*GrantUserGroupToSectionForPurpose*](#grantusergrouptosectionforpurpose)
  - [*RevokeUserGroupFromSectionForPurpose*](#revokeusergroupfromsectionforpurpose)
  - [*UpdateUserGroup*](#updateusergroup)
  - [*DeleteUserGroup*](#deleteusergroup)
  - [*UpdateSection*](#updatesection)
  - [*DeleteSection*](#deletesection)
  - [*CreateEvent*](#createevent)
  - [*UpdateEvent*](#updateevent)
  - [*DeleteEvent*](#deleteevent)
  - [*CreateTicketType*](#createtickettype)
  - [*UpdateTicketType*](#updatetickettype)
  - [*DeleteTicketType*](#deletetickettype)
  - [*CreateUserProfile*](#createuserprofile)
  - [*UpsertUser*](#upsertuser)
  - [*UpdateUser*](#updateuser)
  - [*RegisterForSection*](#registerforsection)
  - [*UnregisterFromSection*](#unregisterfromsection)
  - [*SubscribeToUserGroup*](#subscribetousergroup)
  - [*UnsubscribeFromUserGroup*](#unsubscribefromusergroup)

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

## GetUserGroupByName
You can execute the `GetUserGroupByName` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserGroupByName(vars: GetUserGroupByNameVariables): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;

interface GetUserGroupByNameRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserGroupByNameVariables): QueryRef<GetUserGroupByNameData, GetUserGroupByNameVariables>;
}
export const getUserGroupByNameRef: GetUserGroupByNameRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserGroupByName(dc: DataConnect, vars: GetUserGroupByNameVariables): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;

interface GetUserGroupByNameRef {
  ...
  (dc: DataConnect, vars: GetUserGroupByNameVariables): QueryRef<GetUserGroupByNameData, GetUserGroupByNameVariables>;
}
export const getUserGroupByNameRef: GetUserGroupByNameRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserGroupByNameRef:
```typescript
const name = getUserGroupByNameRef.operationName;
console.log(name);
```

### Variables
The `GetUserGroupByName` query requires an argument of type `GetUserGroupByNameVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserGroupByNameVariables {
  name: string;
}
```
### Return Type
Recall that executing the `GetUserGroupByName` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserGroupByNameData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserGroupByNameData {
  userGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
  } & UserGroup_Key)[];
}
```
### Using `GetUserGroupByName`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserGroupByName, GetUserGroupByNameVariables } from '@dataconnect/generated';

// The `GetUserGroupByName` query requires an argument of type `GetUserGroupByNameVariables`:
const getUserGroupByNameVars: GetUserGroupByNameVariables = {
  name: ..., 
};

// Call the `getUserGroupByName()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserGroupByName(getUserGroupByNameVars);
// Variables can be defined inline as well.
const { data } = await getUserGroupByName({ name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserGroupByName(dataConnect, getUserGroupByNameVars);

console.log(data.userGroups);

// Or, you can use the `Promise` API.
getUserGroupByName(getUserGroupByNameVars).then((response) => {
  const data = response.data;
  console.log(data.userGroups);
});
```

### Using `GetUserGroupByName`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserGroupByNameRef, GetUserGroupByNameVariables } from '@dataconnect/generated';

// The `GetUserGroupByName` query requires an argument of type `GetUserGroupByNameVariables`:
const getUserGroupByNameVars: GetUserGroupByNameVariables = {
  name: ..., 
};

// Call the `getUserGroupByNameRef()` function to get a reference to the query.
const ref = getUserGroupByNameRef(getUserGroupByNameVars);
// Variables can be defined inline as well.
const ref = getUserGroupByNameRef({ name: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserGroupByNameRef(dataConnect, getUserGroupByNameVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.userGroups);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroups);
});
```

## GetUserUserGroupsForAdmin
You can execute the `GetUserUserGroupsForAdmin` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserUserGroupsForAdmin(vars: GetUserUserGroupsForAdminVariables): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;

interface GetUserUserGroupsForAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserUserGroupsForAdminVariables): QueryRef<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
}
export const getUserUserGroupsForAdminRef: GetUserUserGroupsForAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserUserGroupsForAdmin(dc: DataConnect, vars: GetUserUserGroupsForAdminVariables): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;

interface GetUserUserGroupsForAdminRef {
  ...
  (dc: DataConnect, vars: GetUserUserGroupsForAdminVariables): QueryRef<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
}
export const getUserUserGroupsForAdminRef: GetUserUserGroupsForAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserUserGroupsForAdminRef:
```typescript
const name = getUserUserGroupsForAdminRef.operationName;
console.log(name);
```

### Variables
The `GetUserUserGroupsForAdmin` query requires an argument of type `GetUserUserGroupsForAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserUserGroupsForAdminVariables {
  userId: string;
}
```
### Return Type
Recall that executing the `GetUserUserGroupsForAdmin` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserUserGroupsForAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserUserGroupsForAdminData {
  user?: {
    id: string;
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & UserGroup_Key;
    })[];
  } & User_Key;
}
```
### Using `GetUserUserGroupsForAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserUserGroupsForAdmin, GetUserUserGroupsForAdminVariables } from '@dataconnect/generated';

// The `GetUserUserGroupsForAdmin` query requires an argument of type `GetUserUserGroupsForAdminVariables`:
const getUserUserGroupsForAdminVars: GetUserUserGroupsForAdminVariables = {
  userId: ..., 
};

// Call the `getUserUserGroupsForAdmin()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserUserGroupsForAdmin(getUserUserGroupsForAdminVars);
// Variables can be defined inline as well.
const { data } = await getUserUserGroupsForAdmin({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserUserGroupsForAdmin(dataConnect, getUserUserGroupsForAdminVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserUserGroupsForAdmin(getUserUserGroupsForAdminVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserUserGroupsForAdmin`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserUserGroupsForAdminRef, GetUserUserGroupsForAdminVariables } from '@dataconnect/generated';

// The `GetUserUserGroupsForAdmin` query requires an argument of type `GetUserUserGroupsForAdminVariables`:
const getUserUserGroupsForAdminVars: GetUserUserGroupsForAdminVariables = {
  userId: ..., 
};

// Call the `getUserUserGroupsForAdminRef()` function to get a reference to the query.
const ref = getUserUserGroupsForAdminRef(getUserUserGroupsForAdminVars);
// Variables can be defined inline as well.
const ref = getUserUserGroupsForAdminRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserUserGroupsForAdminRef(dataConnect, getUserUserGroupsForAdminVars);

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
    membershipStatus: MembershipStatus;
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
        purposeLinks: ({
          purpose: SectionUserGroupPurpose;
          section: {
            id: UUIDString;
            name: string;
            type: SectionType;
            description?: string | null;
          } & Section_Key;
        })[];
      } & UserGroup_Key;
    })[];
  } & User_Key;
    allUserGroups: ({
      id: UUIDString;
      name: string;
      membershipStatuses?: MembershipStatus[] | null;
      purposeLinks: ({
        purpose: SectionUserGroupPurpose;
        section: {
          id: UUIDString;
          name: string;
          type: SectionType;
          description?: string | null;
        } & Section_Key;
      })[];
    } & UserGroup_Key)[];
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
console.log(data.allUserGroups);

// Or, you can use the `Promise` API.
getSectionsForUser().then((response) => {
  const data = response.data;
  console.log(data.user);
  console.log(data.allUserGroups);
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
console.log(data.allUserGroups);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
  console.log(data.allUserGroups);
});
```

## ListUserGroups
You can execute the `ListUserGroups` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUserGroups(): QueryPromise<ListUserGroupsData, undefined>;

interface ListUserGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUserGroupsData, undefined>;
}
export const listUserGroupsRef: ListUserGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUserGroups(dc: DataConnect): QueryPromise<ListUserGroupsData, undefined>;

interface ListUserGroupsRef {
  ...
  (dc: DataConnect): QueryRef<ListUserGroupsData, undefined>;
}
export const listUserGroupsRef: ListUserGroupsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUserGroupsRef:
```typescript
const name = listUserGroupsRef.operationName;
console.log(name);
```

### Variables
The `ListUserGroups` query has no variables.
### Return Type
Recall that executing the `ListUserGroups` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUserGroupsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUserGroupsData {
  userGroups: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    membershipStatuses?: MembershipStatus[] | null;
    subscribable?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    createdBy?: string | null;
    updatedBy?: string | null;
  } & UserGroup_Key)[];
}
```
### Using `ListUserGroups`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUserGroups } from '@dataconnect/generated';


// Call the `listUserGroups()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUserGroups();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUserGroups(dataConnect);

console.log(data.userGroups);

// Or, you can use the `Promise` API.
listUserGroups().then((response) => {
  const data = response.data;
  console.log(data.userGroups);
});
```

### Using `ListUserGroups`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUserGroupsRef } from '@dataconnect/generated';


// Call the `listUserGroupsRef()` function to get a reference to the query.
const ref = listUserGroupsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUserGroupsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.userGroups);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroups);
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
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & UserGroup_Key;
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
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
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
    userGroups: ({
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
      } & UserGroup_Key;
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

## GetEventsForSection
You can execute the `GetEventsForSection` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getEventsForSection(vars: GetEventsForSectionVariables): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;

interface GetEventsForSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventsForSectionVariables): QueryRef<GetEventsForSectionData, GetEventsForSectionVariables>;
}
export const getEventsForSectionRef: GetEventsForSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEventsForSection(dc: DataConnect, vars: GetEventsForSectionVariables): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;

interface GetEventsForSectionRef {
  ...
  (dc: DataConnect, vars: GetEventsForSectionVariables): QueryRef<GetEventsForSectionData, GetEventsForSectionVariables>;
}
export const getEventsForSectionRef: GetEventsForSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getEventsForSectionRef:
```typescript
const name = getEventsForSectionRef.operationName;
console.log(name);
```

### Variables
The `GetEventsForSection` query requires an argument of type `GetEventsForSectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetEventsForSectionVariables {
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `GetEventsForSection` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetEventsForSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetEventsForSectionData {
  section?: {
    id: UUIDString;
    events: ({
      id: UUIDString;
      title: string;
      location?: string | null;
      guestOfHonour?: string | null;
      startDateTime: TimestampString;
      endDateTime: TimestampString;
      bookingStartDateTime: TimestampString;
      bookingEndDateTime: TimestampString;
    } & Event_Key)[];
  } & Section_Key;
}
```
### Using `GetEventsForSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getEventsForSection, GetEventsForSectionVariables } from '@dataconnect/generated';

// The `GetEventsForSection` query requires an argument of type `GetEventsForSectionVariables`:
const getEventsForSectionVars: GetEventsForSectionVariables = {
  sectionId: ..., 
};

// Call the `getEventsForSection()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getEventsForSection(getEventsForSectionVars);
// Variables can be defined inline as well.
const { data } = await getEventsForSection({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getEventsForSection(dataConnect, getEventsForSectionVars);

console.log(data.section);

// Or, you can use the `Promise` API.
getEventsForSection(getEventsForSectionVars).then((response) => {
  const data = response.data;
  console.log(data.section);
});
```

### Using `GetEventsForSection`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getEventsForSectionRef, GetEventsForSectionVariables } from '@dataconnect/generated';

// The `GetEventsForSection` query requires an argument of type `GetEventsForSectionVariables`:
const getEventsForSectionVars: GetEventsForSectionVariables = {
  sectionId: ..., 
};

// Call the `getEventsForSectionRef()` function to get a reference to the query.
const ref = getEventsForSectionRef(getEventsForSectionVars);
// Variables can be defined inline as well.
const ref = getEventsForSectionRef({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getEventsForSectionRef(dataConnect, getEventsForSectionVars);

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

## GetEventById
You can execute the `GetEventById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getEventById(vars: GetEventByIdVariables): QueryPromise<GetEventByIdData, GetEventByIdVariables>;

interface GetEventByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventByIdVariables): QueryRef<GetEventByIdData, GetEventByIdVariables>;
}
export const getEventByIdRef: GetEventByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEventById(dc: DataConnect, vars: GetEventByIdVariables): QueryPromise<GetEventByIdData, GetEventByIdVariables>;

interface GetEventByIdRef {
  ...
  (dc: DataConnect, vars: GetEventByIdVariables): QueryRef<GetEventByIdData, GetEventByIdVariables>;
}
export const getEventByIdRef: GetEventByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getEventByIdRef:
```typescript
const name = getEventByIdRef.operationName;
console.log(name);
```

### Variables
The `GetEventById` query requires an argument of type `GetEventByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetEventByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetEventById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetEventByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetEventByIdData {
  event?: {
    id: UUIDString;
    section: {
      id: UUIDString;
    } & Section_Key;
      title: string;
      location?: string | null;
      guestOfHonour?: string | null;
      startDateTime: TimestampString;
      endDateTime: TimestampString;
      bookingStartDateTime: TimestampString;
      bookingEndDateTime: TimestampString;
      ticketTypes: ({
        id: UUIDString;
        title: string;
        description?: string | null;
        price: number;
        sortOrder: number;
        userGroup: {
          id: UUIDString;
          name: string;
        } & UserGroup_Key;
      } & TicketType_Key)[];
  } & Event_Key;
}
```
### Using `GetEventById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getEventById, GetEventByIdVariables } from '@dataconnect/generated';

// The `GetEventById` query requires an argument of type `GetEventByIdVariables`:
const getEventByIdVars: GetEventByIdVariables = {
  id: ..., 
};

// Call the `getEventById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getEventById(getEventByIdVars);
// Variables can be defined inline as well.
const { data } = await getEventById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getEventById(dataConnect, getEventByIdVars);

console.log(data.event);

// Or, you can use the `Promise` API.
getEventById(getEventByIdVars).then((response) => {
  const data = response.data;
  console.log(data.event);
});
```

### Using `GetEventById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getEventByIdRef, GetEventByIdVariables } from '@dataconnect/generated';

// The `GetEventById` query requires an argument of type `GetEventByIdVariables`:
const getEventByIdVars: GetEventByIdVariables = {
  id: ..., 
};

// Call the `getEventByIdRef()` function to get a reference to the query.
const ref = getEventByIdRef(getEventByIdVars);
// Variables can be defined inline as well.
const ref = getEventByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getEventByIdRef(dataConnect, getEventByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.event);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.event);
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
    allowedUserGroups?: UUIDString[] | null;
    purposeLinks: ({
      purpose: SectionUserGroupPurpose;
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
      } & UserGroup_Key;
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

## GetUserGroupById
You can execute the `GetUserGroupById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserGroupById(vars: GetUserGroupByIdVariables): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;

interface GetUserGroupByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserGroupByIdVariables): QueryRef<GetUserGroupByIdData, GetUserGroupByIdVariables>;
}
export const getUserGroupByIdRef: GetUserGroupByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserGroupById(dc: DataConnect, vars: GetUserGroupByIdVariables): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;

interface GetUserGroupByIdRef {
  ...
  (dc: DataConnect, vars: GetUserGroupByIdVariables): QueryRef<GetUserGroupByIdData, GetUserGroupByIdVariables>;
}
export const getUserGroupByIdRef: GetUserGroupByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserGroupByIdRef:
```typescript
const name = getUserGroupByIdRef.operationName;
console.log(name);
```

### Variables
The `GetUserGroupById` query requires an argument of type `GetUserGroupByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserGroupByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetUserGroupById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserGroupByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserGroupByIdData {
  userGroup?: {
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
      purposeLinks: ({
        purpose: SectionUserGroupPurpose;
        section: {
          id: UUIDString;
          name: string;
          type: SectionType;
          description?: string | null;
        } & Section_Key;
      })[];
  } & UserGroup_Key;
}
```
### Using `GetUserGroupById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserGroupById, GetUserGroupByIdVariables } from '@dataconnect/generated';

// The `GetUserGroupById` query requires an argument of type `GetUserGroupByIdVariables`:
const getUserGroupByIdVars: GetUserGroupByIdVariables = {
  id: ..., 
};

// Call the `getUserGroupById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserGroupById(getUserGroupByIdVars);
// Variables can be defined inline as well.
const { data } = await getUserGroupById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserGroupById(dataConnect, getUserGroupByIdVars);

console.log(data.userGroup);

// Or, you can use the `Promise` API.
getUserGroupById(getUserGroupByIdVars).then((response) => {
  const data = response.data;
  console.log(data.userGroup);
});
```

### Using `GetUserGroupById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserGroupByIdRef, GetUserGroupByIdVariables } from '@dataconnect/generated';

// The `GetUserGroupById` query requires an argument of type `GetUserGroupByIdVariables`:
const getUserGroupByIdVars: GetUserGroupByIdVariables = {
  id: ..., 
};

// Call the `getUserGroupByIdRef()` function to get a reference to the query.
const ref = getUserGroupByIdRef(getUserGroupByIdVars);
// Variables can be defined inline as well.
const ref = getUserGroupByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserGroupByIdRef(dataConnect, getUserGroupByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.userGroup);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroup);
});
```

## GetAllUserGroupsWithStatuses
You can execute the `GetAllUserGroupsWithStatuses` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAllUserGroupsWithStatuses(): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;

interface GetAllUserGroupsWithStatusesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllUserGroupsWithStatusesData, undefined>;
}
export const getAllUserGroupsWithStatusesRef: GetAllUserGroupsWithStatusesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAllUserGroupsWithStatuses(dc: DataConnect): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;

interface GetAllUserGroupsWithStatusesRef {
  ...
  (dc: DataConnect): QueryRef<GetAllUserGroupsWithStatusesData, undefined>;
}
export const getAllUserGroupsWithStatusesRef: GetAllUserGroupsWithStatusesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAllUserGroupsWithStatusesRef:
```typescript
const name = getAllUserGroupsWithStatusesRef.operationName;
console.log(name);
```

### Variables
The `GetAllUserGroupsWithStatuses` query has no variables.
### Return Type
Recall that executing the `GetAllUserGroupsWithStatuses` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAllUserGroupsWithStatusesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAllUserGroupsWithStatusesData {
  userGroups: ({
    id: UUIDString;
    name: string;
    membershipStatuses?: MembershipStatus[] | null;
  } & UserGroup_Key)[];
}
```
### Using `GetAllUserGroupsWithStatuses`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAllUserGroupsWithStatuses } from '@dataconnect/generated';


// Call the `getAllUserGroupsWithStatuses()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAllUserGroupsWithStatuses();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAllUserGroupsWithStatuses(dataConnect);

console.log(data.userGroups);

// Or, you can use the `Promise` API.
getAllUserGroupsWithStatuses().then((response) => {
  const data = response.data;
  console.log(data.userGroups);
});
```

### Using `GetAllUserGroupsWithStatuses`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAllUserGroupsWithStatusesRef } from '@dataconnect/generated';


// Call the `getAllUserGroupsWithStatusesRef()` function to get a reference to the query.
const ref = getAllUserGroupsWithStatusesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAllUserGroupsWithStatusesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.userGroups);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroups);
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
    purposeLinks: ({
      purpose: SectionUserGroupPurpose;
      userGroup: {
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
      } & UserGroup_Key;
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

## CreateUserGroupAdmin
You can execute the `CreateUserGroupAdmin` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUserGroupAdmin(vars: CreateUserGroupAdminVariables): MutationPromise<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;

interface CreateUserGroupAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserGroupAdminVariables): MutationRef<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;
}
export const createUserGroupAdminRef: CreateUserGroupAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUserGroupAdmin(dc: DataConnect, vars: CreateUserGroupAdminVariables): MutationPromise<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;

interface CreateUserGroupAdminRef {
  ...
  (dc: DataConnect, vars: CreateUserGroupAdminVariables): MutationRef<CreateUserGroupAdminData, CreateUserGroupAdminVariables>;
}
export const createUserGroupAdminRef: CreateUserGroupAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserGroupAdminRef:
```typescript
const name = createUserGroupAdminRef.operationName;
console.log(name);
```

### Variables
The `CreateUserGroupAdmin` mutation requires an argument of type `CreateUserGroupAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserGroupAdminVariables {
  name: string;
  description?: string | null;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `CreateUserGroupAdmin` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserGroupAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserGroupAdminData {
  userGroup_insert: UserGroup_Key;
}
```
### Using `CreateUserGroupAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUserGroupAdmin, CreateUserGroupAdminVariables } from '@dataconnect/generated';

// The `CreateUserGroupAdmin` mutation requires an argument of type `CreateUserGroupAdminVariables`:
const createUserGroupAdminVars: CreateUserGroupAdminVariables = {
  name: ..., 
  description: ..., // optional
  now: ..., 
};

// Call the `createUserGroupAdmin()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUserGroupAdmin(createUserGroupAdminVars);
// Variables can be defined inline as well.
const { data } = await createUserGroupAdmin({ name: ..., description: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUserGroupAdmin(dataConnect, createUserGroupAdminVars);

console.log(data.userGroup_insert);

// Or, you can use the `Promise` API.
createUserGroupAdmin(createUserGroupAdminVars).then((response) => {
  const data = response.data;
  console.log(data.userGroup_insert);
});
```

### Using `CreateUserGroupAdmin`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserGroupAdminRef, CreateUserGroupAdminVariables } from '@dataconnect/generated';

// The `CreateUserGroupAdmin` mutation requires an argument of type `CreateUserGroupAdminVariables`:
const createUserGroupAdminVars: CreateUserGroupAdminVariables = {
  name: ..., 
  description: ..., // optional
  now: ..., 
};

// Call the `createUserGroupAdminRef()` function to get a reference to the mutation.
const ref = createUserGroupAdminRef(createUserGroupAdminVars);
// Variables can be defined inline as well.
const ref = createUserGroupAdminRef({ name: ..., description: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserGroupAdminRef(dataConnect, createUserGroupAdminVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userGroup_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroup_insert);
});
```

## AddUserToUserGroupAdmin
You can execute the `AddUserToUserGroupAdmin` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addUserToUserGroupAdmin(vars: AddUserToUserGroupAdminVariables): MutationPromise<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;

interface AddUserToUserGroupAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToUserGroupAdminVariables): MutationRef<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;
}
export const addUserToUserGroupAdminRef: AddUserToUserGroupAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addUserToUserGroupAdmin(dc: DataConnect, vars: AddUserToUserGroupAdminVariables): MutationPromise<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;

interface AddUserToUserGroupAdminRef {
  ...
  (dc: DataConnect, vars: AddUserToUserGroupAdminVariables): MutationRef<AddUserToUserGroupAdminData, AddUserToUserGroupAdminVariables>;
}
export const addUserToUserGroupAdminRef: AddUserToUserGroupAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addUserToUserGroupAdminRef:
```typescript
const name = addUserToUserGroupAdminRef.operationName;
console.log(name);
```

### Variables
The `AddUserToUserGroupAdmin` mutation requires an argument of type `AddUserToUserGroupAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddUserToUserGroupAdminVariables {
  userId: string;
  userGroupId: UUIDString;
  now: TimestampString;
}
```
### Return Type
Recall that executing the `AddUserToUserGroupAdmin` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddUserToUserGroupAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddUserToUserGroupAdminData {
  userUserGroup_upsert: UserUserGroup_Key;
}
```
### Using `AddUserToUserGroupAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addUserToUserGroupAdmin, AddUserToUserGroupAdminVariables } from '@dataconnect/generated';

// The `AddUserToUserGroupAdmin` mutation requires an argument of type `AddUserToUserGroupAdminVariables`:
const addUserToUserGroupAdminVars: AddUserToUserGroupAdminVariables = {
  userId: ..., 
  userGroupId: ..., 
  now: ..., 
};

// Call the `addUserToUserGroupAdmin()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addUserToUserGroupAdmin(addUserToUserGroupAdminVars);
// Variables can be defined inline as well.
const { data } = await addUserToUserGroupAdmin({ userId: ..., userGroupId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addUserToUserGroupAdmin(dataConnect, addUserToUserGroupAdminVars);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
addUserToUserGroupAdmin(addUserToUserGroupAdminVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
});
```

### Using `AddUserToUserGroupAdmin`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addUserToUserGroupAdminRef, AddUserToUserGroupAdminVariables } from '@dataconnect/generated';

// The `AddUserToUserGroupAdmin` mutation requires an argument of type `AddUserToUserGroupAdminVariables`:
const addUserToUserGroupAdminVars: AddUserToUserGroupAdminVariables = {
  userId: ..., 
  userGroupId: ..., 
  now: ..., 
};

// Call the `addUserToUserGroupAdminRef()` function to get a reference to the mutation.
const ref = addUserToUserGroupAdminRef(addUserToUserGroupAdminVars);
// Variables can be defined inline as well.
const ref = addUserToUserGroupAdminRef({ userId: ..., userGroupId: ..., now: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addUserToUserGroupAdminRef(dataConnect, addUserToUserGroupAdminVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
});
```

## RemoveUserFromUserGroupAdmin
You can execute the `RemoveUserFromUserGroupAdmin` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeUserFromUserGroupAdmin(vars: RemoveUserFromUserGroupAdminVariables): MutationPromise<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;

interface RemoveUserFromUserGroupAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromUserGroupAdminVariables): MutationRef<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;
}
export const removeUserFromUserGroupAdminRef: RemoveUserFromUserGroupAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeUserFromUserGroupAdmin(dc: DataConnect, vars: RemoveUserFromUserGroupAdminVariables): MutationPromise<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;

interface RemoveUserFromUserGroupAdminRef {
  ...
  (dc: DataConnect, vars: RemoveUserFromUserGroupAdminVariables): MutationRef<RemoveUserFromUserGroupAdminData, RemoveUserFromUserGroupAdminVariables>;
}
export const removeUserFromUserGroupAdminRef: RemoveUserFromUserGroupAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeUserFromUserGroupAdminRef:
```typescript
const name = removeUserFromUserGroupAdminRef.operationName;
console.log(name);
```

### Variables
The `RemoveUserFromUserGroupAdmin` mutation requires an argument of type `RemoveUserFromUserGroupAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveUserFromUserGroupAdminVariables {
  userId: string;
  userGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RemoveUserFromUserGroupAdmin` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveUserFromUserGroupAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveUserFromUserGroupAdminData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}
```
### Using `RemoveUserFromUserGroupAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeUserFromUserGroupAdmin, RemoveUserFromUserGroupAdminVariables } from '@dataconnect/generated';

// The `RemoveUserFromUserGroupAdmin` mutation requires an argument of type `RemoveUserFromUserGroupAdminVariables`:
const removeUserFromUserGroupAdminVars: RemoveUserFromUserGroupAdminVariables = {
  userId: ..., 
  userGroupId: ..., 
};

// Call the `removeUserFromUserGroupAdmin()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeUserFromUserGroupAdmin(removeUserFromUserGroupAdminVars);
// Variables can be defined inline as well.
const { data } = await removeUserFromUserGroupAdmin({ userId: ..., userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeUserFromUserGroupAdmin(dataConnect, removeUserFromUserGroupAdminVars);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
removeUserFromUserGroupAdmin(removeUserFromUserGroupAdminVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
});
```

### Using `RemoveUserFromUserGroupAdmin`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeUserFromUserGroupAdminRef, RemoveUserFromUserGroupAdminVariables } from '@dataconnect/generated';

// The `RemoveUserFromUserGroupAdmin` mutation requires an argument of type `RemoveUserFromUserGroupAdminVariables`:
const removeUserFromUserGroupAdminVars: RemoveUserFromUserGroupAdminVariables = {
  userId: ..., 
  userGroupId: ..., 
};

// Call the `removeUserFromUserGroupAdminRef()` function to get a reference to the mutation.
const ref = removeUserFromUserGroupAdminRef(removeUserFromUserGroupAdminVars);
// Variables can be defined inline as well.
const ref = removeUserFromUserGroupAdminRef({ userId: ..., userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeUserFromUserGroupAdminRef(dataConnect, removeUserFromUserGroupAdminVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
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

## CreateUserGroup
You can execute the `CreateUserGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUserGroup(vars: CreateUserGroupVariables): MutationPromise<CreateUserGroupData, CreateUserGroupVariables>;

interface CreateUserGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserGroupVariables): MutationRef<CreateUserGroupData, CreateUserGroupVariables>;
}
export const createUserGroupRef: CreateUserGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUserGroup(dc: DataConnect, vars: CreateUserGroupVariables): MutationPromise<CreateUserGroupData, CreateUserGroupVariables>;

interface CreateUserGroupRef {
  ...
  (dc: DataConnect, vars: CreateUserGroupVariables): MutationRef<CreateUserGroupData, CreateUserGroupVariables>;
}
export const createUserGroupRef: CreateUserGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserGroupRef:
```typescript
const name = createUserGroupRef.operationName;
console.log(name);
```

### Variables
The `CreateUserGroup` mutation requires an argument of type `CreateUserGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserGroupVariables {
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
  subscribable?: boolean | null;
}
```
### Return Type
Recall that executing the `CreateUserGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserGroupData {
  userGroup_insert: UserGroup_Key;
}
```
### Using `CreateUserGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUserGroup, CreateUserGroupVariables } from '@dataconnect/generated';

// The `CreateUserGroup` mutation requires an argument of type `CreateUserGroupVariables`:
const createUserGroupVars: CreateUserGroupVariables = {
  name: ..., 
  description: ..., // optional
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `createUserGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUserGroup(createUserGroupVars);
// Variables can be defined inline as well.
const { data } = await createUserGroup({ name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUserGroup(dataConnect, createUserGroupVars);

console.log(data.userGroup_insert);

// Or, you can use the `Promise` API.
createUserGroup(createUserGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userGroup_insert);
});
```

### Using `CreateUserGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserGroupRef, CreateUserGroupVariables } from '@dataconnect/generated';

// The `CreateUserGroup` mutation requires an argument of type `CreateUserGroupVariables`:
const createUserGroupVars: CreateUserGroupVariables = {
  name: ..., 
  description: ..., // optional
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `createUserGroupRef()` function to get a reference to the mutation.
const ref = createUserGroupRef(createUserGroupVars);
// Variables can be defined inline as well.
const ref = createUserGroupRef({ name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserGroupRef(dataConnect, createUserGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userGroup_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroup_insert);
});
```

## AddUserToUserGroup
You can execute the `AddUserToUserGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addUserToUserGroup(vars: AddUserToUserGroupVariables): MutationPromise<AddUserToUserGroupData, AddUserToUserGroupVariables>;

interface AddUserToUserGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddUserToUserGroupVariables): MutationRef<AddUserToUserGroupData, AddUserToUserGroupVariables>;
}
export const addUserToUserGroupRef: AddUserToUserGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addUserToUserGroup(dc: DataConnect, vars: AddUserToUserGroupVariables): MutationPromise<AddUserToUserGroupData, AddUserToUserGroupVariables>;

interface AddUserToUserGroupRef {
  ...
  (dc: DataConnect, vars: AddUserToUserGroupVariables): MutationRef<AddUserToUserGroupData, AddUserToUserGroupVariables>;
}
export const addUserToUserGroupRef: AddUserToUserGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addUserToUserGroupRef:
```typescript
const name = addUserToUserGroupRef.operationName;
console.log(name);
```

### Variables
The `AddUserToUserGroup` mutation requires an argument of type `AddUserToUserGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddUserToUserGroupVariables {
  userId: string;
  userGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `AddUserToUserGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddUserToUserGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddUserToUserGroupData {
  userUserGroup_upsert: UserUserGroup_Key;
}
```
### Using `AddUserToUserGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addUserToUserGroup, AddUserToUserGroupVariables } from '@dataconnect/generated';

// The `AddUserToUserGroup` mutation requires an argument of type `AddUserToUserGroupVariables`:
const addUserToUserGroupVars: AddUserToUserGroupVariables = {
  userId: ..., 
  userGroupId: ..., 
};

// Call the `addUserToUserGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addUserToUserGroup(addUserToUserGroupVars);
// Variables can be defined inline as well.
const { data } = await addUserToUserGroup({ userId: ..., userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addUserToUserGroup(dataConnect, addUserToUserGroupVars);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
addUserToUserGroup(addUserToUserGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
});
```

### Using `AddUserToUserGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addUserToUserGroupRef, AddUserToUserGroupVariables } from '@dataconnect/generated';

// The `AddUserToUserGroup` mutation requires an argument of type `AddUserToUserGroupVariables`:
const addUserToUserGroupVars: AddUserToUserGroupVariables = {
  userId: ..., 
  userGroupId: ..., 
};

// Call the `addUserToUserGroupRef()` function to get a reference to the mutation.
const ref = addUserToUserGroupRef(addUserToUserGroupVars);
// Variables can be defined inline as well.
const ref = addUserToUserGroupRef({ userId: ..., userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addUserToUserGroupRef(dataConnect, addUserToUserGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
});
```

## RemoveUserFromUserGroup
You can execute the `RemoveUserFromUserGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeUserFromUserGroup(vars: RemoveUserFromUserGroupVariables): MutationPromise<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;

interface RemoveUserFromUserGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveUserFromUserGroupVariables): MutationRef<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;
}
export const removeUserFromUserGroupRef: RemoveUserFromUserGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeUserFromUserGroup(dc: DataConnect, vars: RemoveUserFromUserGroupVariables): MutationPromise<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;

interface RemoveUserFromUserGroupRef {
  ...
  (dc: DataConnect, vars: RemoveUserFromUserGroupVariables): MutationRef<RemoveUserFromUserGroupData, RemoveUserFromUserGroupVariables>;
}
export const removeUserFromUserGroupRef: RemoveUserFromUserGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeUserFromUserGroupRef:
```typescript
const name = removeUserFromUserGroupRef.operationName;
console.log(name);
```

### Variables
The `RemoveUserFromUserGroup` mutation requires an argument of type `RemoveUserFromUserGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveUserFromUserGroupVariables {
  userId: string;
  userGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RemoveUserFromUserGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveUserFromUserGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveUserFromUserGroupData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}
```
### Using `RemoveUserFromUserGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeUserFromUserGroup, RemoveUserFromUserGroupVariables } from '@dataconnect/generated';

// The `RemoveUserFromUserGroup` mutation requires an argument of type `RemoveUserFromUserGroupVariables`:
const removeUserFromUserGroupVars: RemoveUserFromUserGroupVariables = {
  userId: ..., 
  userGroupId: ..., 
};

// Call the `removeUserFromUserGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeUserFromUserGroup(removeUserFromUserGroupVars);
// Variables can be defined inline as well.
const { data } = await removeUserFromUserGroup({ userId: ..., userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeUserFromUserGroup(dataConnect, removeUserFromUserGroupVars);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
removeUserFromUserGroup(removeUserFromUserGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
});
```

### Using `RemoveUserFromUserGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeUserFromUserGroupRef, RemoveUserFromUserGroupVariables } from '@dataconnect/generated';

// The `RemoveUserFromUserGroup` mutation requires an argument of type `RemoveUserFromUserGroupVariables`:
const removeUserFromUserGroupVars: RemoveUserFromUserGroupVariables = {
  userId: ..., 
  userGroupId: ..., 
};

// Call the `removeUserFromUserGroupRef()` function to get a reference to the mutation.
const ref = removeUserFromUserGroupRef(removeUserFromUserGroupVars);
// Variables can be defined inline as well.
const ref = removeUserFromUserGroupRef({ userId: ..., userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeUserFromUserGroupRef(dataConnect, removeUserFromUserGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
});
```

## GrantUserGroupToSectionForPurpose
You can execute the `GrantUserGroupToSectionForPurpose` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
grantUserGroupToSectionForPurpose(vars: GrantUserGroupToSectionForPurposeVariables): MutationPromise<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;

interface GrantUserGroupToSectionForPurposeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GrantUserGroupToSectionForPurposeVariables): MutationRef<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;
}
export const grantUserGroupToSectionForPurposeRef: GrantUserGroupToSectionForPurposeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
grantUserGroupToSectionForPurpose(dc: DataConnect, vars: GrantUserGroupToSectionForPurposeVariables): MutationPromise<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;

interface GrantUserGroupToSectionForPurposeRef {
  ...
  (dc: DataConnect, vars: GrantUserGroupToSectionForPurposeVariables): MutationRef<GrantUserGroupToSectionForPurposeData, GrantUserGroupToSectionForPurposeVariables>;
}
export const grantUserGroupToSectionForPurposeRef: GrantUserGroupToSectionForPurposeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the grantUserGroupToSectionForPurposeRef:
```typescript
const name = grantUserGroupToSectionForPurposeRef.operationName;
console.log(name);
```

### Variables
The `GrantUserGroupToSectionForPurpose` mutation requires an argument of type `GrantUserGroupToSectionForPurposeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GrantUserGroupToSectionForPurposeVariables {
  sectionId: UUIDString;
  userGroupId: UUIDString;
  purpose: SectionUserGroupPurpose;
}
```
### Return Type
Recall that executing the `GrantUserGroupToSectionForPurpose` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GrantUserGroupToSectionForPurposeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GrantUserGroupToSectionForPurposeData {
  sectionUserGroupPurposeLink_upsert: SectionUserGroupPurposeLink_Key;
}
```
### Using `GrantUserGroupToSectionForPurpose`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, grantUserGroupToSectionForPurpose, GrantUserGroupToSectionForPurposeVariables } from '@dataconnect/generated';

// The `GrantUserGroupToSectionForPurpose` mutation requires an argument of type `GrantUserGroupToSectionForPurposeVariables`:
const grantUserGroupToSectionForPurposeVars: GrantUserGroupToSectionForPurposeVariables = {
  sectionId: ..., 
  userGroupId: ..., 
  purpose: ..., 
};

// Call the `grantUserGroupToSectionForPurpose()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await grantUserGroupToSectionForPurpose(grantUserGroupToSectionForPurposeVars);
// Variables can be defined inline as well.
const { data } = await grantUserGroupToSectionForPurpose({ sectionId: ..., userGroupId: ..., purpose: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await grantUserGroupToSectionForPurpose(dataConnect, grantUserGroupToSectionForPurposeVars);

console.log(data.sectionUserGroupPurposeLink_upsert);

// Or, you can use the `Promise` API.
grantUserGroupToSectionForPurpose(grantUserGroupToSectionForPurposeVars).then((response) => {
  const data = response.data;
  console.log(data.sectionUserGroupPurposeLink_upsert);
});
```

### Using `GrantUserGroupToSectionForPurpose`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, grantUserGroupToSectionForPurposeRef, GrantUserGroupToSectionForPurposeVariables } from '@dataconnect/generated';

// The `GrantUserGroupToSectionForPurpose` mutation requires an argument of type `GrantUserGroupToSectionForPurposeVariables`:
const grantUserGroupToSectionForPurposeVars: GrantUserGroupToSectionForPurposeVariables = {
  sectionId: ..., 
  userGroupId: ..., 
  purpose: ..., 
};

// Call the `grantUserGroupToSectionForPurposeRef()` function to get a reference to the mutation.
const ref = grantUserGroupToSectionForPurposeRef(grantUserGroupToSectionForPurposeVars);
// Variables can be defined inline as well.
const ref = grantUserGroupToSectionForPurposeRef({ sectionId: ..., userGroupId: ..., purpose: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = grantUserGroupToSectionForPurposeRef(dataConnect, grantUserGroupToSectionForPurposeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionUserGroupPurposeLink_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionUserGroupPurposeLink_upsert);
});
```

## RevokeUserGroupFromSectionForPurpose
You can execute the `RevokeUserGroupFromSectionForPurpose` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
revokeUserGroupFromSectionForPurpose(vars: RevokeUserGroupFromSectionForPurposeVariables): MutationPromise<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;

interface RevokeUserGroupFromSectionForPurposeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RevokeUserGroupFromSectionForPurposeVariables): MutationRef<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;
}
export const revokeUserGroupFromSectionForPurposeRef: RevokeUserGroupFromSectionForPurposeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
revokeUserGroupFromSectionForPurpose(dc: DataConnect, vars: RevokeUserGroupFromSectionForPurposeVariables): MutationPromise<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;

interface RevokeUserGroupFromSectionForPurposeRef {
  ...
  (dc: DataConnect, vars: RevokeUserGroupFromSectionForPurposeVariables): MutationRef<RevokeUserGroupFromSectionForPurposeData, RevokeUserGroupFromSectionForPurposeVariables>;
}
export const revokeUserGroupFromSectionForPurposeRef: RevokeUserGroupFromSectionForPurposeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the revokeUserGroupFromSectionForPurposeRef:
```typescript
const name = revokeUserGroupFromSectionForPurposeRef.operationName;
console.log(name);
```

### Variables
The `RevokeUserGroupFromSectionForPurpose` mutation requires an argument of type `RevokeUserGroupFromSectionForPurposeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RevokeUserGroupFromSectionForPurposeVariables {
  sectionId: UUIDString;
  userGroupId: UUIDString;
  purpose: SectionUserGroupPurpose;
}
```
### Return Type
Recall that executing the `RevokeUserGroupFromSectionForPurpose` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RevokeUserGroupFromSectionForPurposeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RevokeUserGroupFromSectionForPurposeData {
  sectionUserGroupPurposeLink_delete?: SectionUserGroupPurposeLink_Key | null;
}
```
### Using `RevokeUserGroupFromSectionForPurpose`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, revokeUserGroupFromSectionForPurpose, RevokeUserGroupFromSectionForPurposeVariables } from '@dataconnect/generated';

// The `RevokeUserGroupFromSectionForPurpose` mutation requires an argument of type `RevokeUserGroupFromSectionForPurposeVariables`:
const revokeUserGroupFromSectionForPurposeVars: RevokeUserGroupFromSectionForPurposeVariables = {
  sectionId: ..., 
  userGroupId: ..., 
  purpose: ..., 
};

// Call the `revokeUserGroupFromSectionForPurpose()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await revokeUserGroupFromSectionForPurpose(revokeUserGroupFromSectionForPurposeVars);
// Variables can be defined inline as well.
const { data } = await revokeUserGroupFromSectionForPurpose({ sectionId: ..., userGroupId: ..., purpose: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await revokeUserGroupFromSectionForPurpose(dataConnect, revokeUserGroupFromSectionForPurposeVars);

console.log(data.sectionUserGroupPurposeLink_delete);

// Or, you can use the `Promise` API.
revokeUserGroupFromSectionForPurpose(revokeUserGroupFromSectionForPurposeVars).then((response) => {
  const data = response.data;
  console.log(data.sectionUserGroupPurposeLink_delete);
});
```

### Using `RevokeUserGroupFromSectionForPurpose`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, revokeUserGroupFromSectionForPurposeRef, RevokeUserGroupFromSectionForPurposeVariables } from '@dataconnect/generated';

// The `RevokeUserGroupFromSectionForPurpose` mutation requires an argument of type `RevokeUserGroupFromSectionForPurposeVariables`:
const revokeUserGroupFromSectionForPurposeVars: RevokeUserGroupFromSectionForPurposeVariables = {
  sectionId: ..., 
  userGroupId: ..., 
  purpose: ..., 
};

// Call the `revokeUserGroupFromSectionForPurposeRef()` function to get a reference to the mutation.
const ref = revokeUserGroupFromSectionForPurposeRef(revokeUserGroupFromSectionForPurposeVars);
// Variables can be defined inline as well.
const ref = revokeUserGroupFromSectionForPurposeRef({ sectionId: ..., userGroupId: ..., purpose: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = revokeUserGroupFromSectionForPurposeRef(dataConnect, revokeUserGroupFromSectionForPurposeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionUserGroupPurposeLink_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionUserGroupPurposeLink_delete);
});
```

## UpdateUserGroup
You can execute the `UpdateUserGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUserGroup(vars: UpdateUserGroupVariables): MutationPromise<UpdateUserGroupData, UpdateUserGroupVariables>;

interface UpdateUserGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserGroupVariables): MutationRef<UpdateUserGroupData, UpdateUserGroupVariables>;
}
export const updateUserGroupRef: UpdateUserGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUserGroup(dc: DataConnect, vars: UpdateUserGroupVariables): MutationPromise<UpdateUserGroupData, UpdateUserGroupVariables>;

interface UpdateUserGroupRef {
  ...
  (dc: DataConnect, vars: UpdateUserGroupVariables): MutationRef<UpdateUserGroupData, UpdateUserGroupVariables>;
}
export const updateUserGroupRef: UpdateUserGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserGroupRef:
```typescript
const name = updateUserGroupRef.operationName;
console.log(name);
```

### Variables
The `UpdateUserGroup` mutation requires an argument of type `UpdateUserGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserGroupVariables {
  id: UUIDString;
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
  subscribable?: boolean | null;
}
```
### Return Type
Recall that executing the `UpdateUserGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserGroupData {
  userGroup_update?: UserGroup_Key | null;
}
```
### Using `UpdateUserGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUserGroup, UpdateUserGroupVariables } from '@dataconnect/generated';

// The `UpdateUserGroup` mutation requires an argument of type `UpdateUserGroupVariables`:
const updateUserGroupVars: UpdateUserGroupVariables = {
  id: ..., 
  name: ..., 
  description: ..., // optional
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `updateUserGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUserGroup(updateUserGroupVars);
// Variables can be defined inline as well.
const { data } = await updateUserGroup({ id: ..., name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUserGroup(dataConnect, updateUserGroupVars);

console.log(data.userGroup_update);

// Or, you can use the `Promise` API.
updateUserGroup(updateUserGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userGroup_update);
});
```

### Using `UpdateUserGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserGroupRef, UpdateUserGroupVariables } from '@dataconnect/generated';

// The `UpdateUserGroup` mutation requires an argument of type `UpdateUserGroupVariables`:
const updateUserGroupVars: UpdateUserGroupVariables = {
  id: ..., 
  name: ..., 
  description: ..., // optional
  membershipStatuses: ..., // optional
  subscribable: ..., // optional
};

// Call the `updateUserGroupRef()` function to get a reference to the mutation.
const ref = updateUserGroupRef(updateUserGroupVars);
// Variables can be defined inline as well.
const ref = updateUserGroupRef({ id: ..., name: ..., description: ..., membershipStatuses: ..., subscribable: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserGroupRef(dataConnect, updateUserGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userGroup_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroup_update);
});
```

## DeleteUserGroup
You can execute the `DeleteUserGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteUserGroup(vars: DeleteUserGroupVariables): MutationPromise<DeleteUserGroupData, DeleteUserGroupVariables>;

interface DeleteUserGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUserGroupVariables): MutationRef<DeleteUserGroupData, DeleteUserGroupVariables>;
}
export const deleteUserGroupRef: DeleteUserGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteUserGroup(dc: DataConnect, vars: DeleteUserGroupVariables): MutationPromise<DeleteUserGroupData, DeleteUserGroupVariables>;

interface DeleteUserGroupRef {
  ...
  (dc: DataConnect, vars: DeleteUserGroupVariables): MutationRef<DeleteUserGroupData, DeleteUserGroupVariables>;
}
export const deleteUserGroupRef: DeleteUserGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteUserGroupRef:
```typescript
const name = deleteUserGroupRef.operationName;
console.log(name);
```

### Variables
The `DeleteUserGroup` mutation requires an argument of type `DeleteUserGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteUserGroupVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteUserGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteUserGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteUserGroupData {
  userGroup_delete?: UserGroup_Key | null;
}
```
### Using `DeleteUserGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteUserGroup, DeleteUserGroupVariables } from '@dataconnect/generated';

// The `DeleteUserGroup` mutation requires an argument of type `DeleteUserGroupVariables`:
const deleteUserGroupVars: DeleteUserGroupVariables = {
  id: ..., 
};

// Call the `deleteUserGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteUserGroup(deleteUserGroupVars);
// Variables can be defined inline as well.
const { data } = await deleteUserGroup({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteUserGroup(dataConnect, deleteUserGroupVars);

console.log(data.userGroup_delete);

// Or, you can use the `Promise` API.
deleteUserGroup(deleteUserGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userGroup_delete);
});
```

### Using `DeleteUserGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteUserGroupRef, DeleteUserGroupVariables } from '@dataconnect/generated';

// The `DeleteUserGroup` mutation requires an argument of type `DeleteUserGroupVariables`:
const deleteUserGroupVars: DeleteUserGroupVariables = {
  id: ..., 
};

// Call the `deleteUserGroupRef()` function to get a reference to the mutation.
const ref = deleteUserGroupRef(deleteUserGroupVars);
// Variables can be defined inline as well.
const ref = deleteUserGroupRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteUserGroupRef(dataConnect, deleteUserGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userGroup_delete);
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

## CreateEvent
You can execute the `CreateEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createEvent(vars: CreateEventVariables): MutationPromise<CreateEventData, CreateEventVariables>;

interface CreateEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateEventVariables): MutationRef<CreateEventData, CreateEventVariables>;
}
export const createEventRef: CreateEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createEvent(dc: DataConnect, vars: CreateEventVariables): MutationPromise<CreateEventData, CreateEventVariables>;

interface CreateEventRef {
  ...
  (dc: DataConnect, vars: CreateEventVariables): MutationRef<CreateEventData, CreateEventVariables>;
}
export const createEventRef: CreateEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createEventRef:
```typescript
const name = createEventRef.operationName;
console.log(name);
```

### Variables
The `CreateEvent` mutation requires an argument of type `CreateEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateEventVariables {
  sectionId: UUIDString;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: TimestampString;
  endDateTime: TimestampString;
  bookingStartDateTime: TimestampString;
  bookingEndDateTime: TimestampString;
}
```
### Return Type
Recall that executing the `CreateEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateEventData {
  event_insert: Event_Key;
}
```
### Using `CreateEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createEvent, CreateEventVariables } from '@dataconnect/generated';

// The `CreateEvent` mutation requires an argument of type `CreateEventVariables`:
const createEventVars: CreateEventVariables = {
  sectionId: ..., 
  title: ..., 
  location: ..., // optional
  guestOfHonour: ..., // optional
  startDateTime: ..., 
  endDateTime: ..., 
  bookingStartDateTime: ..., 
  bookingEndDateTime: ..., 
};

// Call the `createEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createEvent(createEventVars);
// Variables can be defined inline as well.
const { data } = await createEvent({ sectionId: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createEvent(dataConnect, createEventVars);

console.log(data.event_insert);

// Or, you can use the `Promise` API.
createEvent(createEventVars).then((response) => {
  const data = response.data;
  console.log(data.event_insert);
});
```

### Using `CreateEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createEventRef, CreateEventVariables } from '@dataconnect/generated';

// The `CreateEvent` mutation requires an argument of type `CreateEventVariables`:
const createEventVars: CreateEventVariables = {
  sectionId: ..., 
  title: ..., 
  location: ..., // optional
  guestOfHonour: ..., // optional
  startDateTime: ..., 
  endDateTime: ..., 
  bookingStartDateTime: ..., 
  bookingEndDateTime: ..., 
};

// Call the `createEventRef()` function to get a reference to the mutation.
const ref = createEventRef(createEventVars);
// Variables can be defined inline as well.
const ref = createEventRef({ sectionId: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createEventRef(dataConnect, createEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.event_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.event_insert);
});
```

## UpdateEvent
You can execute the `UpdateEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateEvent(vars: UpdateEventVariables): MutationPromise<UpdateEventData, UpdateEventVariables>;

interface UpdateEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateEventVariables): MutationRef<UpdateEventData, UpdateEventVariables>;
}
export const updateEventRef: UpdateEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateEvent(dc: DataConnect, vars: UpdateEventVariables): MutationPromise<UpdateEventData, UpdateEventVariables>;

interface UpdateEventRef {
  ...
  (dc: DataConnect, vars: UpdateEventVariables): MutationRef<UpdateEventData, UpdateEventVariables>;
}
export const updateEventRef: UpdateEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateEventRef:
```typescript
const name = updateEventRef.operationName;
console.log(name);
```

### Variables
The `UpdateEvent` mutation requires an argument of type `UpdateEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateEventVariables {
  id: UUIDString;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: TimestampString;
  endDateTime: TimestampString;
  bookingStartDateTime: TimestampString;
  bookingEndDateTime: TimestampString;
}
```
### Return Type
Recall that executing the `UpdateEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateEventData {
  event_update?: Event_Key | null;
}
```
### Using `UpdateEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateEvent, UpdateEventVariables } from '@dataconnect/generated';

// The `UpdateEvent` mutation requires an argument of type `UpdateEventVariables`:
const updateEventVars: UpdateEventVariables = {
  id: ..., 
  title: ..., 
  location: ..., // optional
  guestOfHonour: ..., // optional
  startDateTime: ..., 
  endDateTime: ..., 
  bookingStartDateTime: ..., 
  bookingEndDateTime: ..., 
};

// Call the `updateEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateEvent(updateEventVars);
// Variables can be defined inline as well.
const { data } = await updateEvent({ id: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateEvent(dataConnect, updateEventVars);

console.log(data.event_update);

// Or, you can use the `Promise` API.
updateEvent(updateEventVars).then((response) => {
  const data = response.data;
  console.log(data.event_update);
});
```

### Using `UpdateEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateEventRef, UpdateEventVariables } from '@dataconnect/generated';

// The `UpdateEvent` mutation requires an argument of type `UpdateEventVariables`:
const updateEventVars: UpdateEventVariables = {
  id: ..., 
  title: ..., 
  location: ..., // optional
  guestOfHonour: ..., // optional
  startDateTime: ..., 
  endDateTime: ..., 
  bookingStartDateTime: ..., 
  bookingEndDateTime: ..., 
};

// Call the `updateEventRef()` function to get a reference to the mutation.
const ref = updateEventRef(updateEventVars);
// Variables can be defined inline as well.
const ref = updateEventRef({ id: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateEventRef(dataConnect, updateEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.event_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.event_update);
});
```

## DeleteEvent
You can execute the `DeleteEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteEvent(vars: DeleteEventVariables): MutationPromise<DeleteEventData, DeleteEventVariables>;

interface DeleteEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteEventVariables): MutationRef<DeleteEventData, DeleteEventVariables>;
}
export const deleteEventRef: DeleteEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteEvent(dc: DataConnect, vars: DeleteEventVariables): MutationPromise<DeleteEventData, DeleteEventVariables>;

interface DeleteEventRef {
  ...
  (dc: DataConnect, vars: DeleteEventVariables): MutationRef<DeleteEventData, DeleteEventVariables>;
}
export const deleteEventRef: DeleteEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteEventRef:
```typescript
const name = deleteEventRef.operationName;
console.log(name);
```

### Variables
The `DeleteEvent` mutation requires an argument of type `DeleteEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteEventVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteEventData {
  event_delete?: Event_Key | null;
}
```
### Using `DeleteEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteEvent, DeleteEventVariables } from '@dataconnect/generated';

// The `DeleteEvent` mutation requires an argument of type `DeleteEventVariables`:
const deleteEventVars: DeleteEventVariables = {
  id: ..., 
};

// Call the `deleteEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteEvent(deleteEventVars);
// Variables can be defined inline as well.
const { data } = await deleteEvent({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteEvent(dataConnect, deleteEventVars);

console.log(data.event_delete);

// Or, you can use the `Promise` API.
deleteEvent(deleteEventVars).then((response) => {
  const data = response.data;
  console.log(data.event_delete);
});
```

### Using `DeleteEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteEventRef, DeleteEventVariables } from '@dataconnect/generated';

// The `DeleteEvent` mutation requires an argument of type `DeleteEventVariables`:
const deleteEventVars: DeleteEventVariables = {
  id: ..., 
};

// Call the `deleteEventRef()` function to get a reference to the mutation.
const ref = deleteEventRef(deleteEventVars);
// Variables can be defined inline as well.
const ref = deleteEventRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteEventRef(dataConnect, deleteEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.event_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.event_delete);
});
```

## CreateTicketType
You can execute the `CreateTicketType` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createTicketType(vars: CreateTicketTypeVariables): MutationPromise<CreateTicketTypeData, CreateTicketTypeVariables>;

interface CreateTicketTypeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTicketTypeVariables): MutationRef<CreateTicketTypeData, CreateTicketTypeVariables>;
}
export const createTicketTypeRef: CreateTicketTypeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createTicketType(dc: DataConnect, vars: CreateTicketTypeVariables): MutationPromise<CreateTicketTypeData, CreateTicketTypeVariables>;

interface CreateTicketTypeRef {
  ...
  (dc: DataConnect, vars: CreateTicketTypeVariables): MutationRef<CreateTicketTypeData, CreateTicketTypeVariables>;
}
export const createTicketTypeRef: CreateTicketTypeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createTicketTypeRef:
```typescript
const name = createTicketTypeRef.operationName;
console.log(name);
```

### Variables
The `CreateTicketType` mutation requires an argument of type `CreateTicketTypeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateTicketTypeVariables {
  eventId: UUIDString;
  userGroupId: UUIDString;
  title: string;
  description?: string | null;
  price: number;
  sortOrder?: number | null;
}
```
### Return Type
Recall that executing the `CreateTicketType` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateTicketTypeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateTicketTypeData {
  ticketType_insert: TicketType_Key;
}
```
### Using `CreateTicketType`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createTicketType, CreateTicketTypeVariables } from '@dataconnect/generated';

// The `CreateTicketType` mutation requires an argument of type `CreateTicketTypeVariables`:
const createTicketTypeVars: CreateTicketTypeVariables = {
  eventId: ..., 
  userGroupId: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., // optional
};

// Call the `createTicketType()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createTicketType(createTicketTypeVars);
// Variables can be defined inline as well.
const { data } = await createTicketType({ eventId: ..., userGroupId: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createTicketType(dataConnect, createTicketTypeVars);

console.log(data.ticketType_insert);

// Or, you can use the `Promise` API.
createTicketType(createTicketTypeVars).then((response) => {
  const data = response.data;
  console.log(data.ticketType_insert);
});
```

### Using `CreateTicketType`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createTicketTypeRef, CreateTicketTypeVariables } from '@dataconnect/generated';

// The `CreateTicketType` mutation requires an argument of type `CreateTicketTypeVariables`:
const createTicketTypeVars: CreateTicketTypeVariables = {
  eventId: ..., 
  userGroupId: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., // optional
};

// Call the `createTicketTypeRef()` function to get a reference to the mutation.
const ref = createTicketTypeRef(createTicketTypeVars);
// Variables can be defined inline as well.
const ref = createTicketTypeRef({ eventId: ..., userGroupId: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createTicketTypeRef(dataConnect, createTicketTypeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketType_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketType_insert);
});
```

## UpdateTicketType
You can execute the `UpdateTicketType` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateTicketType(vars: UpdateTicketTypeVariables): MutationPromise<UpdateTicketTypeData, UpdateTicketTypeVariables>;

interface UpdateTicketTypeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTicketTypeVariables): MutationRef<UpdateTicketTypeData, UpdateTicketTypeVariables>;
}
export const updateTicketTypeRef: UpdateTicketTypeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateTicketType(dc: DataConnect, vars: UpdateTicketTypeVariables): MutationPromise<UpdateTicketTypeData, UpdateTicketTypeVariables>;

interface UpdateTicketTypeRef {
  ...
  (dc: DataConnect, vars: UpdateTicketTypeVariables): MutationRef<UpdateTicketTypeData, UpdateTicketTypeVariables>;
}
export const updateTicketTypeRef: UpdateTicketTypeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateTicketTypeRef:
```typescript
const name = updateTicketTypeRef.operationName;
console.log(name);
```

### Variables
The `UpdateTicketType` mutation requires an argument of type `UpdateTicketTypeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateTicketTypeVariables {
  id: UUIDString;
  userGroupId: UUIDString;
  title: string;
  description?: string | null;
  price: number;
  sortOrder: number;
}
```
### Return Type
Recall that executing the `UpdateTicketType` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateTicketTypeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateTicketTypeData {
  ticketType_update?: TicketType_Key | null;
}
```
### Using `UpdateTicketType`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateTicketType, UpdateTicketTypeVariables } from '@dataconnect/generated';

// The `UpdateTicketType` mutation requires an argument of type `UpdateTicketTypeVariables`:
const updateTicketTypeVars: UpdateTicketTypeVariables = {
  id: ..., 
  userGroupId: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., 
};

// Call the `updateTicketType()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateTicketType(updateTicketTypeVars);
// Variables can be defined inline as well.
const { data } = await updateTicketType({ id: ..., userGroupId: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateTicketType(dataConnect, updateTicketTypeVars);

console.log(data.ticketType_update);

// Or, you can use the `Promise` API.
updateTicketType(updateTicketTypeVars).then((response) => {
  const data = response.data;
  console.log(data.ticketType_update);
});
```

### Using `UpdateTicketType`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateTicketTypeRef, UpdateTicketTypeVariables } from '@dataconnect/generated';

// The `UpdateTicketType` mutation requires an argument of type `UpdateTicketTypeVariables`:
const updateTicketTypeVars: UpdateTicketTypeVariables = {
  id: ..., 
  userGroupId: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., 
};

// Call the `updateTicketTypeRef()` function to get a reference to the mutation.
const ref = updateTicketTypeRef(updateTicketTypeVars);
// Variables can be defined inline as well.
const ref = updateTicketTypeRef({ id: ..., userGroupId: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateTicketTypeRef(dataConnect, updateTicketTypeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketType_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketType_update);
});
```

## DeleteTicketType
You can execute the `DeleteTicketType` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteTicketType(vars: DeleteTicketTypeVariables): MutationPromise<DeleteTicketTypeData, DeleteTicketTypeVariables>;

interface DeleteTicketTypeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteTicketTypeVariables): MutationRef<DeleteTicketTypeData, DeleteTicketTypeVariables>;
}
export const deleteTicketTypeRef: DeleteTicketTypeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteTicketType(dc: DataConnect, vars: DeleteTicketTypeVariables): MutationPromise<DeleteTicketTypeData, DeleteTicketTypeVariables>;

interface DeleteTicketTypeRef {
  ...
  (dc: DataConnect, vars: DeleteTicketTypeVariables): MutationRef<DeleteTicketTypeData, DeleteTicketTypeVariables>;
}
export const deleteTicketTypeRef: DeleteTicketTypeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteTicketTypeRef:
```typescript
const name = deleteTicketTypeRef.operationName;
console.log(name);
```

### Variables
The `DeleteTicketType` mutation requires an argument of type `DeleteTicketTypeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteTicketTypeVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteTicketType` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteTicketTypeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteTicketTypeData {
  ticketType_delete?: TicketType_Key | null;
}
```
### Using `DeleteTicketType`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteTicketType, DeleteTicketTypeVariables } from '@dataconnect/generated';

// The `DeleteTicketType` mutation requires an argument of type `DeleteTicketTypeVariables`:
const deleteTicketTypeVars: DeleteTicketTypeVariables = {
  id: ..., 
};

// Call the `deleteTicketType()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteTicketType(deleteTicketTypeVars);
// Variables can be defined inline as well.
const { data } = await deleteTicketType({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteTicketType(dataConnect, deleteTicketTypeVars);

console.log(data.ticketType_delete);

// Or, you can use the `Promise` API.
deleteTicketType(deleteTicketTypeVars).then((response) => {
  const data = response.data;
  console.log(data.ticketType_delete);
});
```

### Using `DeleteTicketType`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteTicketTypeRef, DeleteTicketTypeVariables } from '@dataconnect/generated';

// The `DeleteTicketType` mutation requires an argument of type `DeleteTicketTypeVariables`:
const deleteTicketTypeVars: DeleteTicketTypeVariables = {
  id: ..., 
};

// Call the `deleteTicketTypeRef()` function to get a reference to the mutation.
const ref = deleteTicketTypeRef(deleteTicketTypeVars);
// Variables can be defined inline as well.
const ref = deleteTicketTypeRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteTicketTypeRef(dataConnect, deleteTicketTypeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketType_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketType_delete);
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
  userGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `RegisterForSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RegisterForSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RegisterForSectionData {
  userUserGroup_upsert: UserUserGroup_Key;
}
```
### Using `RegisterForSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, registerForSection, RegisterForSectionVariables } from '@dataconnect/generated';

// The `RegisterForSection` mutation requires an argument of type `RegisterForSectionVariables`:
const registerForSectionVars: RegisterForSectionVariables = {
  userGroupId: ..., 
};

// Call the `registerForSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await registerForSection(registerForSectionVars);
// Variables can be defined inline as well.
const { data } = await registerForSection({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await registerForSection(dataConnect, registerForSectionVars);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
registerForSection(registerForSectionVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
});
```

### Using `RegisterForSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, registerForSectionRef, RegisterForSectionVariables } from '@dataconnect/generated';

// The `RegisterForSection` mutation requires an argument of type `RegisterForSectionVariables`:
const registerForSectionVars: RegisterForSectionVariables = {
  userGroupId: ..., 
};

// Call the `registerForSectionRef()` function to get a reference to the mutation.
const ref = registerForSectionRef(registerForSectionVars);
// Variables can be defined inline as well.
const ref = registerForSectionRef({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = registerForSectionRef(dataConnect, registerForSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
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
  userGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `UnregisterFromSection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UnregisterFromSectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UnregisterFromSectionData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}
```
### Using `UnregisterFromSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, unregisterFromSection, UnregisterFromSectionVariables } from '@dataconnect/generated';

// The `UnregisterFromSection` mutation requires an argument of type `UnregisterFromSectionVariables`:
const unregisterFromSectionVars: UnregisterFromSectionVariables = {
  userGroupId: ..., 
};

// Call the `unregisterFromSection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await unregisterFromSection(unregisterFromSectionVars);
// Variables can be defined inline as well.
const { data } = await unregisterFromSection({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await unregisterFromSection(dataConnect, unregisterFromSectionVars);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
unregisterFromSection(unregisterFromSectionVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
});
```

### Using `UnregisterFromSection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, unregisterFromSectionRef, UnregisterFromSectionVariables } from '@dataconnect/generated';

// The `UnregisterFromSection` mutation requires an argument of type `UnregisterFromSectionVariables`:
const unregisterFromSectionVars: UnregisterFromSectionVariables = {
  userGroupId: ..., 
};

// Call the `unregisterFromSectionRef()` function to get a reference to the mutation.
const ref = unregisterFromSectionRef(unregisterFromSectionVars);
// Variables can be defined inline as well.
const ref = unregisterFromSectionRef({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = unregisterFromSectionRef(dataConnect, unregisterFromSectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
});
```

## SubscribeToUserGroup
You can execute the `SubscribeToUserGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
subscribeToUserGroup(vars: SubscribeToUserGroupVariables): MutationPromise<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;

interface SubscribeToUserGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SubscribeToUserGroupVariables): MutationRef<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;
}
export const subscribeToUserGroupRef: SubscribeToUserGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
subscribeToUserGroup(dc: DataConnect, vars: SubscribeToUserGroupVariables): MutationPromise<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;

interface SubscribeToUserGroupRef {
  ...
  (dc: DataConnect, vars: SubscribeToUserGroupVariables): MutationRef<SubscribeToUserGroupData, SubscribeToUserGroupVariables>;
}
export const subscribeToUserGroupRef: SubscribeToUserGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the subscribeToUserGroupRef:
```typescript
const name = subscribeToUserGroupRef.operationName;
console.log(name);
```

### Variables
The `SubscribeToUserGroup` mutation requires an argument of type `SubscribeToUserGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SubscribeToUserGroupVariables {
  userGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `SubscribeToUserGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SubscribeToUserGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SubscribeToUserGroupData {
  userUserGroup_upsert: UserUserGroup_Key;
}
```
### Using `SubscribeToUserGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, subscribeToUserGroup, SubscribeToUserGroupVariables } from '@dataconnect/generated';

// The `SubscribeToUserGroup` mutation requires an argument of type `SubscribeToUserGroupVariables`:
const subscribeToUserGroupVars: SubscribeToUserGroupVariables = {
  userGroupId: ..., 
};

// Call the `subscribeToUserGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await subscribeToUserGroup(subscribeToUserGroupVars);
// Variables can be defined inline as well.
const { data } = await subscribeToUserGroup({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await subscribeToUserGroup(dataConnect, subscribeToUserGroupVars);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
subscribeToUserGroup(subscribeToUserGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
});
```

### Using `SubscribeToUserGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, subscribeToUserGroupRef, SubscribeToUserGroupVariables } from '@dataconnect/generated';

// The `SubscribeToUserGroup` mutation requires an argument of type `SubscribeToUserGroupVariables`:
const subscribeToUserGroupVars: SubscribeToUserGroupVariables = {
  userGroupId: ..., 
};

// Call the `subscribeToUserGroupRef()` function to get a reference to the mutation.
const ref = subscribeToUserGroupRef(subscribeToUserGroupVars);
// Variables can be defined inline as well.
const ref = subscribeToUserGroupRef({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = subscribeToUserGroupRef(dataConnect, subscribeToUserGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_upsert);
});
```

## UnsubscribeFromUserGroup
You can execute the `UnsubscribeFromUserGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
unsubscribeFromUserGroup(vars: UnsubscribeFromUserGroupVariables): MutationPromise<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;

interface UnsubscribeFromUserGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnsubscribeFromUserGroupVariables): MutationRef<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;
}
export const unsubscribeFromUserGroupRef: UnsubscribeFromUserGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
unsubscribeFromUserGroup(dc: DataConnect, vars: UnsubscribeFromUserGroupVariables): MutationPromise<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;

interface UnsubscribeFromUserGroupRef {
  ...
  (dc: DataConnect, vars: UnsubscribeFromUserGroupVariables): MutationRef<UnsubscribeFromUserGroupData, UnsubscribeFromUserGroupVariables>;
}
export const unsubscribeFromUserGroupRef: UnsubscribeFromUserGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the unsubscribeFromUserGroupRef:
```typescript
const name = unsubscribeFromUserGroupRef.operationName;
console.log(name);
```

### Variables
The `UnsubscribeFromUserGroup` mutation requires an argument of type `UnsubscribeFromUserGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UnsubscribeFromUserGroupVariables {
  userGroupId: UUIDString;
}
```
### Return Type
Recall that executing the `UnsubscribeFromUserGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UnsubscribeFromUserGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UnsubscribeFromUserGroupData {
  userUserGroup_delete?: UserUserGroup_Key | null;
}
```
### Using `UnsubscribeFromUserGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, unsubscribeFromUserGroup, UnsubscribeFromUserGroupVariables } from '@dataconnect/generated';

// The `UnsubscribeFromUserGroup` mutation requires an argument of type `UnsubscribeFromUserGroupVariables`:
const unsubscribeFromUserGroupVars: UnsubscribeFromUserGroupVariables = {
  userGroupId: ..., 
};

// Call the `unsubscribeFromUserGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await unsubscribeFromUserGroup(unsubscribeFromUserGroupVars);
// Variables can be defined inline as well.
const { data } = await unsubscribeFromUserGroup({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await unsubscribeFromUserGroup(dataConnect, unsubscribeFromUserGroupVars);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
unsubscribeFromUserGroup(unsubscribeFromUserGroupVars).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
});
```

### Using `UnsubscribeFromUserGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, unsubscribeFromUserGroupRef, UnsubscribeFromUserGroupVariables } from '@dataconnect/generated';

// The `UnsubscribeFromUserGroup` mutation requires an argument of type `UnsubscribeFromUserGroupVariables`:
const unsubscribeFromUserGroupVars: UnsubscribeFromUserGroupVariables = {
  userGroupId: ..., 
};

// Call the `unsubscribeFromUserGroupRef()` function to get a reference to the mutation.
const ref = unsubscribeFromUserGroupRef(unsubscribeFromUserGroupVars);
// Variables can be defined inline as well.
const ref = unsubscribeFromUserGroupRef({ userGroupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = unsubscribeFromUserGroupRef(dataConnect, unsubscribeFromUserGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userUserGroup_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userUserGroup_delete);
});
```

