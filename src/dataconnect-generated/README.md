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
  - [*GetUserForCheckout*](#getuserforcheckout)
  - [*GetTicketTypeForCheckout*](#gettickettypeforcheckout)
  - [*GetEventByIdForCallable*](#geteventbyidforcallable)
  - [*GetSectionByIdForCallable*](#getsectionbyidforcallable)
  - [*GetBookingsForBookerAndEvent*](#getbookingsforbookerandevent)
  - [*GetTicketOrdersForBookerAndEvent*](#getticketordersforbookerandevent)
  - [*GetTicketOrderForWebhook*](#getticketorderforwebhook)
  - [*GetTicketOrderStripeArtifactsForCallable*](#getticketorderstripeartifactsforcallable)
  - [*GetPaymentWebhookEventByStripeEventId*](#getpaymentwebhookeventbystripeeventid)
  - [*GetNotificationDeliveryByChannelAndKey*](#getnotificationdeliverybychannelandkey)
  - [*GetPaymentReconciliationExceptionByOrderAndType*](#getpaymentreconciliationexceptionbyorderandtype)
  - [*GetBookingForGuestTicketCallable*](#getbookingforguestticketcallable)
  - [*GetBookingForNotification*](#getbookingfornotification)
  - [*ListStaleDraftBookingsForScheduler*](#liststaledraftbookingsforscheduler)
  - [*ListStalePendingTicketOrdersForScheduler*](#liststalependingticketordersforscheduler)
  - [*GetGuestTicketRequestForNotification*](#getguestticketrequestfornotification)
  - [*GetSectionAnnouncementOptOuts*](#getsectionannouncementoptouts)
  - [*GetAnnouncementRecipientCount*](#getannouncementrecipientcount)
  - [*GetAnnouncementSendHistory*](#getannouncementsendhistory)
  - [*GetAnnouncementSendRecipients*](#getannouncementsendrecipients)
  - [*GetAnnouncementSendById*](#getannouncementsendbyid)
  - [*GetUserByEmail*](#getuserbyemail)
  - [*GetCallableInvocation*](#getcallableinvocation)
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
  - [*GetMyBookingsForEvent*](#getmybookingsforevent)
  - [*GetMyBookings*](#getmybookings)
  - [*GetMyTicketOrderById*](#getmyticketorderbyid)
  - [*GetMyTicketOrders*](#getmyticketorders)
  - [*GetMyBookingPaymentAdjustments*](#getmybookingpaymentadjustments)
  - [*ListEventBookingsForAdmin*](#listeventbookingsforadmin)
  - [*ListGuestTicketRequestsForAdmin*](#listguestticketrequestsforadmin)
  - [*ListTicketOrdersForAdmin*](#listticketordersforadmin)
  - [*ListBookingPaymentAdjustmentsForAdmin*](#listbookingpaymentadjustmentsforadmin)
  - [*ListOpenPaymentReconciliationExceptions*](#listopenpaymentreconciliationexceptions)
  - [*GetSectionAnnouncementOptOut*](#getsectionannouncementoptout)
  - [*GetMyAnnouncementPreferences*](#getmyannouncementpreferences)
- [**Mutations**](#mutations)
  - [*UpdateUserMembershipStatus*](#updateusermembershipstatus)
  - [*DeleteUser*](#deleteuser)
  - [*CreateUser*](#createuser)
  - [*CreateUserGroupAdmin*](#createusergroupadmin)
  - [*AddUserToUserGroupAdmin*](#addusertousergroupadmin)
  - [*RemoveUserFromUserGroupAdmin*](#removeuserfromusergroupadmin)
  - [*UpdateUserStripeCustomerId*](#updateuserstripecustomerid)
  - [*CreateBookingDraftForUser*](#createbookingdraftforuser)
  - [*CreateBookingDraftRevisionForUser*](#createbookingdraftrevisionforuser)
  - [*MarkBookingSupersededFromCallable*](#markbookingsupersededfromcallable)
  - [*CreateBookingPaymentAdjustmentFromCallable*](#createbookingpaymentadjustmentfromcallable)
  - [*AddBookingLineFromCallable*](#addbookinglinefromcallable)
  - [*UpdateBookingStatusFromCallable*](#updatebookingstatusfromcallable)
  - [*CreateTicketOrderForCheckout*](#createticketorderforcheckout)
  - [*CreatePaymentWebhookEvent*](#createpaymentwebhookevent)
  - [*CreateNotificationDelivery*](#createnotificationdelivery)
  - [*MarkNotificationDeliveryPendingById*](#marknotificationdeliverypendingbyid)
  - [*MarkNotificationDeliverySentById*](#marknotificationdeliverysentbyid)
  - [*MarkNotificationDeliveryFailedById*](#marknotificationdeliveryfailedbyid)
  - [*MarkTicketOrderPaidFromWebhook*](#markticketorderpaidfromwebhook)
  - [*MarkTicketOrderFailedFromWebhook*](#markticketorderfailedfromwebhook)
  - [*MarkTicketOrderRefundedFromWebhook*](#markticketorderrefundedfromwebhook)
  - [*UpsertTicketOrderDisputeFromWebhook*](#upsertticketorderdisputefromwebhook)
  - [*CreatePaymentReconciliationException*](#createpaymentreconciliationexception)
  - [*UpdatePaymentReconciliationExceptionById*](#updatepaymentreconciliationexceptionbyid)
  - [*UpdateBookingPreferencesFromCallable*](#updatebookingpreferencesfromcallable)
  - [*DeleteBookingLineFromCallable*](#deletebookinglinefromcallable)
  - [*CreateGuestTicketRequestFromCallable*](#createguestticketrequestfromcallable)
  - [*AdminReviewGuestTicketRequestFromCallable*](#adminreviewguestticketrequestfromcallable)
  - [*CreateAnnouncementSend*](#createannouncementsend)
  - [*CreateAnnouncementRecipient*](#createannouncementrecipient)
  - [*UpdateEmailBounceStats*](#updateemailbouncestats)
  - [*AdminOptOutSectionAnnouncement*](#adminoptoutsectionannouncement)
  - [*AdminOptInSectionAnnouncement*](#adminoptinsectionannouncement)
  - [*UpsertCallableInvocation*](#upsertcallableinvocation)
  - [*CreateBookingDraft*](#createbookingdraft)
  - [*AddBookingLine*](#addbookingline)
  - [*UpdateBookingStatus*](#updatebookingstatus)
  - [*CreateGuestTicketRequest*](#createguestticketrequest)
  - [*AdminDeleteGuestTicketRequest*](#admindeleteguestticketrequest)
  - [*AdminReviewGuestTicketRequest*](#adminreviewguestticketrequest)
  - [*AdminDeleteBookingLine*](#admindeletebookingline)
  - [*AdminDeleteBooking*](#admindeletebooking)
  - [*ResolvePaymentReconciliationException*](#resolvepaymentreconciliationexception)
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
  - [*OptOutSectionAnnouncement*](#optoutsectionannouncement)
  - [*OptInSectionAnnouncement*](#optinsectionannouncement)

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
getUserGroupByName(vars: GetUserGroupByNameVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;

interface GetUserGroupByNameRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserGroupByNameVariables): QueryRef<GetUserGroupByNameData, GetUserGroupByNameVariables>;
}
export const getUserGroupByNameRef: GetUserGroupByNameRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserGroupByName(dc: DataConnect, vars: GetUserGroupByNameVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByNameData, GetUserGroupByNameVariables>;

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
getUserUserGroupsForAdmin(vars: GetUserUserGroupsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;

interface GetUserUserGroupsForAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserUserGroupsForAdminVariables): QueryRef<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;
}
export const getUserUserGroupsForAdminRef: GetUserUserGroupsForAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserUserGroupsForAdmin(dc: DataConnect, vars: GetUserUserGroupsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserUserGroupsForAdminData, GetUserUserGroupsForAdminVariables>;

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

## GetUserForCheckout
You can execute the `GetUserForCheckout` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserForCheckout(vars: GetUserForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserForCheckoutData, GetUserForCheckoutVariables>;

interface GetUserForCheckoutRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserForCheckoutVariables): QueryRef<GetUserForCheckoutData, GetUserForCheckoutVariables>;
}
export const getUserForCheckoutRef: GetUserForCheckoutRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserForCheckout(dc: DataConnect, vars: GetUserForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserForCheckoutData, GetUserForCheckoutVariables>;

interface GetUserForCheckoutRef {
  ...
  (dc: DataConnect, vars: GetUserForCheckoutVariables): QueryRef<GetUserForCheckoutData, GetUserForCheckoutVariables>;
}
export const getUserForCheckoutRef: GetUserForCheckoutRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserForCheckoutRef:
```typescript
const name = getUserForCheckoutRef.operationName;
console.log(name);
```

### Variables
The `GetUserForCheckout` query requires an argument of type `GetUserForCheckoutVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserForCheckoutVariables {
  userId: string;
}
```
### Return Type
Recall that executing the `GetUserForCheckout` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserForCheckoutData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserForCheckoutData {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    membershipStatus: MembershipStatus;
    stripeCustomerId?: string | null;
  } & User_Key;
}
```
### Using `GetUserForCheckout`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserForCheckout, GetUserForCheckoutVariables } from '@dataconnect/generated';

// The `GetUserForCheckout` query requires an argument of type `GetUserForCheckoutVariables`:
const getUserForCheckoutVars: GetUserForCheckoutVariables = {
  userId: ..., 
};

// Call the `getUserForCheckout()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserForCheckout(getUserForCheckoutVars);
// Variables can be defined inline as well.
const { data } = await getUserForCheckout({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserForCheckout(dataConnect, getUserForCheckoutVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserForCheckout(getUserForCheckoutVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserForCheckout`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserForCheckoutRef, GetUserForCheckoutVariables } from '@dataconnect/generated';

// The `GetUserForCheckout` query requires an argument of type `GetUserForCheckoutVariables`:
const getUserForCheckoutVars: GetUserForCheckoutVariables = {
  userId: ..., 
};

// Call the `getUserForCheckoutRef()` function to get a reference to the query.
const ref = getUserForCheckoutRef(getUserForCheckoutVars);
// Variables can be defined inline as well.
const ref = getUserForCheckoutRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserForCheckoutRef(dataConnect, getUserForCheckoutVars);

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

## GetTicketTypeForCheckout
You can execute the `GetTicketTypeForCheckout` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getTicketTypeForCheckout(vars: GetTicketTypeForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;

interface GetTicketTypeForCheckoutRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketTypeForCheckoutVariables): QueryRef<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
}
export const getTicketTypeForCheckoutRef: GetTicketTypeForCheckoutRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getTicketTypeForCheckout(dc: DataConnect, vars: GetTicketTypeForCheckoutVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;

interface GetTicketTypeForCheckoutRef {
  ...
  (dc: DataConnect, vars: GetTicketTypeForCheckoutVariables): QueryRef<GetTicketTypeForCheckoutData, GetTicketTypeForCheckoutVariables>;
}
export const getTicketTypeForCheckoutRef: GetTicketTypeForCheckoutRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getTicketTypeForCheckoutRef:
```typescript
const name = getTicketTypeForCheckoutRef.operationName;
console.log(name);
```

### Variables
The `GetTicketTypeForCheckout` query requires an argument of type `GetTicketTypeForCheckoutVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetTicketTypeForCheckoutVariables {
  ticketTypeId: UUIDString;
}
```
### Return Type
Recall that executing the `GetTicketTypeForCheckout` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetTicketTypeForCheckoutData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetTicketTypeForCheckoutData {
  ticketType?: {
    id: UUIDString;
    title: string;
    price: number;
    audience: TicketAudience;
    userGroup: {
      id: UUIDString;
      membershipStatuses?: MembershipStatus[] | null;
    } & UserGroup_Key;
    event: {
      id: UUIDString;
      title: string;
      bookingStartDateTime: TimestampString;
      bookingEndDateTime: TimestampString;
      section: {
        id: UUIDString;
      } & Section_Key;
    } & Event_Key;
  } & TicketType_Key;
}
```
### Using `GetTicketTypeForCheckout`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getTicketTypeForCheckout, GetTicketTypeForCheckoutVariables } from '@dataconnect/generated';

// The `GetTicketTypeForCheckout` query requires an argument of type `GetTicketTypeForCheckoutVariables`:
const getTicketTypeForCheckoutVars: GetTicketTypeForCheckoutVariables = {
  ticketTypeId: ..., 
};

// Call the `getTicketTypeForCheckout()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getTicketTypeForCheckout(getTicketTypeForCheckoutVars);
// Variables can be defined inline as well.
const { data } = await getTicketTypeForCheckout({ ticketTypeId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getTicketTypeForCheckout(dataConnect, getTicketTypeForCheckoutVars);

console.log(data.ticketType);

// Or, you can use the `Promise` API.
getTicketTypeForCheckout(getTicketTypeForCheckoutVars).then((response) => {
  const data = response.data;
  console.log(data.ticketType);
});
```

### Using `GetTicketTypeForCheckout`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getTicketTypeForCheckoutRef, GetTicketTypeForCheckoutVariables } from '@dataconnect/generated';

// The `GetTicketTypeForCheckout` query requires an argument of type `GetTicketTypeForCheckoutVariables`:
const getTicketTypeForCheckoutVars: GetTicketTypeForCheckoutVariables = {
  ticketTypeId: ..., 
};

// Call the `getTicketTypeForCheckoutRef()` function to get a reference to the query.
const ref = getTicketTypeForCheckoutRef(getTicketTypeForCheckoutVars);
// Variables can be defined inline as well.
const ref = getTicketTypeForCheckoutRef({ ticketTypeId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getTicketTypeForCheckoutRef(dataConnect, getTicketTypeForCheckoutVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.ticketType);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketType);
});
```

## GetEventByIdForCallable
You can execute the `GetEventByIdForCallable` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getEventByIdForCallable(vars: GetEventByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;

interface GetEventByIdForCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventByIdForCallableVariables): QueryRef<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;
}
export const getEventByIdForCallableRef: GetEventByIdForCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEventByIdForCallable(dc: DataConnect, vars: GetEventByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;

interface GetEventByIdForCallableRef {
  ...
  (dc: DataConnect, vars: GetEventByIdForCallableVariables): QueryRef<GetEventByIdForCallableData, GetEventByIdForCallableVariables>;
}
export const getEventByIdForCallableRef: GetEventByIdForCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getEventByIdForCallableRef:
```typescript
const name = getEventByIdForCallableRef.operationName;
console.log(name);
```

### Variables
The `GetEventByIdForCallable` query requires an argument of type `GetEventByIdForCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetEventByIdForCallableVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetEventByIdForCallable` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetEventByIdForCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetEventByIdForCallableData {
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
    maxGuestsWithoutModeratorApproval?: number | null;
    ticketTypes: ({
      id: UUIDString;
      title: string;
      description?: string | null;
      audience: TicketAudience;
      price: number;
      sortOrder: number;
      userGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
    } & TicketType_Key)[];
  } & Event_Key;
}
```
### Using `GetEventByIdForCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getEventByIdForCallable, GetEventByIdForCallableVariables } from '@dataconnect/generated';

// The `GetEventByIdForCallable` query requires an argument of type `GetEventByIdForCallableVariables`:
const getEventByIdForCallableVars: GetEventByIdForCallableVariables = {
  id: ..., 
};

// Call the `getEventByIdForCallable()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getEventByIdForCallable(getEventByIdForCallableVars);
// Variables can be defined inline as well.
const { data } = await getEventByIdForCallable({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getEventByIdForCallable(dataConnect, getEventByIdForCallableVars);

console.log(data.event);

// Or, you can use the `Promise` API.
getEventByIdForCallable(getEventByIdForCallableVars).then((response) => {
  const data = response.data;
  console.log(data.event);
});
```

### Using `GetEventByIdForCallable`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getEventByIdForCallableRef, GetEventByIdForCallableVariables } from '@dataconnect/generated';

// The `GetEventByIdForCallable` query requires an argument of type `GetEventByIdForCallableVariables`:
const getEventByIdForCallableVars: GetEventByIdForCallableVariables = {
  id: ..., 
};

// Call the `getEventByIdForCallableRef()` function to get a reference to the query.
const ref = getEventByIdForCallableRef(getEventByIdForCallableVars);
// Variables can be defined inline as well.
const ref = getEventByIdForCallableRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getEventByIdForCallableRef(dataConnect, getEventByIdForCallableVars);

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

## GetSectionByIdForCallable
You can execute the `GetSectionByIdForCallable` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSectionByIdForCallable(vars: GetSectionByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;

interface GetSectionByIdForCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdForCallableVariables): QueryRef<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
}
export const getSectionByIdForCallableRef: GetSectionByIdForCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionByIdForCallable(dc: DataConnect, vars: GetSectionByIdForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;

interface GetSectionByIdForCallableRef {
  ...
  (dc: DataConnect, vars: GetSectionByIdForCallableVariables): QueryRef<GetSectionByIdForCallableData, GetSectionByIdForCallableVariables>;
}
export const getSectionByIdForCallableRef: GetSectionByIdForCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSectionByIdForCallableRef:
```typescript
const name = getSectionByIdForCallableRef.operationName;
console.log(name);
```

### Variables
The `GetSectionByIdForCallable` query requires an argument of type `GetSectionByIdForCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSectionByIdForCallableVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetSectionByIdForCallable` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSectionByIdForCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSectionByIdForCallableData {
  section?: {
    id: UUIDString;
    name: string;
    type: SectionType;
    description?: string | null;
    isOpenForRegistration?: boolean | null;
    allowedUserGroups?: UUIDString[] | null;
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
        membershipStatuses?: MembershipStatus[] | null;
      } & UserGroup_Key;
    })[];
  } & Section_Key;
}
```
### Using `GetSectionByIdForCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSectionByIdForCallable, GetSectionByIdForCallableVariables } from '@dataconnect/generated';

// The `GetSectionByIdForCallable` query requires an argument of type `GetSectionByIdForCallableVariables`:
const getSectionByIdForCallableVars: GetSectionByIdForCallableVariables = {
  id: ..., 
};

// Call the `getSectionByIdForCallable()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSectionByIdForCallable(getSectionByIdForCallableVars);
// Variables can be defined inline as well.
const { data } = await getSectionByIdForCallable({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSectionByIdForCallable(dataConnect, getSectionByIdForCallableVars);

console.log(data.section);

// Or, you can use the `Promise` API.
getSectionByIdForCallable(getSectionByIdForCallableVars).then((response) => {
  const data = response.data;
  console.log(data.section);
});
```

### Using `GetSectionByIdForCallable`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSectionByIdForCallableRef, GetSectionByIdForCallableVariables } from '@dataconnect/generated';

// The `GetSectionByIdForCallable` query requires an argument of type `GetSectionByIdForCallableVariables`:
const getSectionByIdForCallableVars: GetSectionByIdForCallableVariables = {
  id: ..., 
};

// Call the `getSectionByIdForCallableRef()` function to get a reference to the query.
const ref = getSectionByIdForCallableRef(getSectionByIdForCallableVars);
// Variables can be defined inline as well.
const ref = getSectionByIdForCallableRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSectionByIdForCallableRef(dataConnect, getSectionByIdForCallableVars);

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

## GetBookingsForBookerAndEvent
You can execute the `GetBookingsForBookerAndEvent` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getBookingsForBookerAndEvent(vars: GetBookingsForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;

interface GetBookingsForBookerAndEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBookingsForBookerAndEventVariables): QueryRef<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
}
export const getBookingsForBookerAndEventRef: GetBookingsForBookerAndEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getBookingsForBookerAndEvent(dc: DataConnect, vars: GetBookingsForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;

interface GetBookingsForBookerAndEventRef {
  ...
  (dc: DataConnect, vars: GetBookingsForBookerAndEventVariables): QueryRef<GetBookingsForBookerAndEventData, GetBookingsForBookerAndEventVariables>;
}
export const getBookingsForBookerAndEventRef: GetBookingsForBookerAndEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getBookingsForBookerAndEventRef:
```typescript
const name = getBookingsForBookerAndEventRef.operationName;
console.log(name);
```

### Variables
The `GetBookingsForBookerAndEvent` query requires an argument of type `GetBookingsForBookerAndEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetBookingsForBookerAndEventVariables {
  bookerId: string;
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `GetBookingsForBookerAndEvent` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetBookingsForBookerAndEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetBookingsForBookerAndEventData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionGroupId: UUIDString;
      revisionNumber: number;
      supersededAt?: TimestampString | null;
      supersedesBooking?: {
        id: UUIDString;
      } & Booking_Key;
      clientSubmissionKey?: string | null;
      bookerDietaryNote?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      lines: ({
        id: UUIDString;
        sortOrder: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        guestUser?: {
          id: string;
        } & User_Key;
        ticketType: {
          id: UUIDString;
          audience: TicketAudience;
          price: number;
          title: string;
        } & TicketType_Key;
      } & BookingLine_Key)[];
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          price: number;
        } & TicketType_Key;
      } & GuestTicketRequest_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}
```
### Using `GetBookingsForBookerAndEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getBookingsForBookerAndEvent, GetBookingsForBookerAndEventVariables } from '@dataconnect/generated';

// The `GetBookingsForBookerAndEvent` query requires an argument of type `GetBookingsForBookerAndEventVariables`:
const getBookingsForBookerAndEventVars: GetBookingsForBookerAndEventVariables = {
  bookerId: ..., 
  eventId: ..., 
};

// Call the `getBookingsForBookerAndEvent()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getBookingsForBookerAndEvent(getBookingsForBookerAndEventVars);
// Variables can be defined inline as well.
const { data } = await getBookingsForBookerAndEvent({ bookerId: ..., eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getBookingsForBookerAndEvent(dataConnect, getBookingsForBookerAndEventVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getBookingsForBookerAndEvent(getBookingsForBookerAndEventVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetBookingsForBookerAndEvent`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getBookingsForBookerAndEventRef, GetBookingsForBookerAndEventVariables } from '@dataconnect/generated';

// The `GetBookingsForBookerAndEvent` query requires an argument of type `GetBookingsForBookerAndEventVariables`:
const getBookingsForBookerAndEventVars: GetBookingsForBookerAndEventVariables = {
  bookerId: ..., 
  eventId: ..., 
};

// Call the `getBookingsForBookerAndEventRef()` function to get a reference to the query.
const ref = getBookingsForBookerAndEventRef(getBookingsForBookerAndEventVars);
// Variables can be defined inline as well.
const ref = getBookingsForBookerAndEventRef({ bookerId: ..., eventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getBookingsForBookerAndEventRef(dataConnect, getBookingsForBookerAndEventVars);

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

## GetTicketOrdersForBookerAndEvent
You can execute the `GetTicketOrdersForBookerAndEvent` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getTicketOrdersForBookerAndEvent(vars: GetTicketOrdersForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;

interface GetTicketOrdersForBookerAndEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketOrdersForBookerAndEventVariables): QueryRef<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;
}
export const getTicketOrdersForBookerAndEventRef: GetTicketOrdersForBookerAndEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getTicketOrdersForBookerAndEvent(dc: DataConnect, vars: GetTicketOrdersForBookerAndEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;

interface GetTicketOrdersForBookerAndEventRef {
  ...
  (dc: DataConnect, vars: GetTicketOrdersForBookerAndEventVariables): QueryRef<GetTicketOrdersForBookerAndEventData, GetTicketOrdersForBookerAndEventVariables>;
}
export const getTicketOrdersForBookerAndEventRef: GetTicketOrdersForBookerAndEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getTicketOrdersForBookerAndEventRef:
```typescript
const name = getTicketOrdersForBookerAndEventRef.operationName;
console.log(name);
```

### Variables
The `GetTicketOrdersForBookerAndEvent` query requires an argument of type `GetTicketOrdersForBookerAndEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetTicketOrdersForBookerAndEventVariables {
  userId: string;
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `GetTicketOrdersForBookerAndEvent` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetTicketOrdersForBookerAndEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetTicketOrdersForBookerAndEventData {
  user?: {
    id: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      createdAt: TimestampString;
      ticketType: {
        id: UUIDString;
      } & TicketType_Key;
      event: {
        id: UUIDString;
      } & Event_Key;
    } & TicketOrder_Key)[];
  } & User_Key;
}
```
### Using `GetTicketOrdersForBookerAndEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getTicketOrdersForBookerAndEvent, GetTicketOrdersForBookerAndEventVariables } from '@dataconnect/generated';

// The `GetTicketOrdersForBookerAndEvent` query requires an argument of type `GetTicketOrdersForBookerAndEventVariables`:
const getTicketOrdersForBookerAndEventVars: GetTicketOrdersForBookerAndEventVariables = {
  userId: ..., 
  eventId: ..., 
};

// Call the `getTicketOrdersForBookerAndEvent()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getTicketOrdersForBookerAndEvent(getTicketOrdersForBookerAndEventVars);
// Variables can be defined inline as well.
const { data } = await getTicketOrdersForBookerAndEvent({ userId: ..., eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getTicketOrdersForBookerAndEvent(dataConnect, getTicketOrdersForBookerAndEventVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getTicketOrdersForBookerAndEvent(getTicketOrdersForBookerAndEventVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetTicketOrdersForBookerAndEvent`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getTicketOrdersForBookerAndEventRef, GetTicketOrdersForBookerAndEventVariables } from '@dataconnect/generated';

// The `GetTicketOrdersForBookerAndEvent` query requires an argument of type `GetTicketOrdersForBookerAndEventVariables`:
const getTicketOrdersForBookerAndEventVars: GetTicketOrdersForBookerAndEventVariables = {
  userId: ..., 
  eventId: ..., 
};

// Call the `getTicketOrdersForBookerAndEventRef()` function to get a reference to the query.
const ref = getTicketOrdersForBookerAndEventRef(getTicketOrdersForBookerAndEventVars);
// Variables can be defined inline as well.
const ref = getTicketOrdersForBookerAndEventRef({ userId: ..., eventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getTicketOrdersForBookerAndEventRef(dataConnect, getTicketOrdersForBookerAndEventVars);

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

## GetTicketOrderForWebhook
You can execute the `GetTicketOrderForWebhook` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getTicketOrderForWebhook(vars: GetTicketOrderForWebhookVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;

interface GetTicketOrderForWebhookRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketOrderForWebhookVariables): QueryRef<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
}
export const getTicketOrderForWebhookRef: GetTicketOrderForWebhookRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getTicketOrderForWebhook(dc: DataConnect, vars: GetTicketOrderForWebhookVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;

interface GetTicketOrderForWebhookRef {
  ...
  (dc: DataConnect, vars: GetTicketOrderForWebhookVariables): QueryRef<GetTicketOrderForWebhookData, GetTicketOrderForWebhookVariables>;
}
export const getTicketOrderForWebhookRef: GetTicketOrderForWebhookRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getTicketOrderForWebhookRef:
```typescript
const name = getTicketOrderForWebhookRef.operationName;
console.log(name);
```

### Variables
The `GetTicketOrderForWebhook` query requires an argument of type `GetTicketOrderForWebhookVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetTicketOrderForWebhookVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetTicketOrderForWebhook` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetTicketOrderForWebhookData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetTicketOrderForWebhookData {
  ticketOrder?: {
    id: UUIDString;
    status: TicketOrderStatus;
    quantity: number;
    unitAmountMinor: number;
    totalAmountMinor: number;
    currency: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    } & User_Key;
    event: {
      id: UUIDString;
      title: string;
    } & Event_Key;
    ticketType: {
      id: UUIDString;
      title: string;
    } & TicketType_Key;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeRefundId?: string | null;
    refundedAmountMinor?: number | null;
    refundedAt?: TimestampString | null;
    stripeDisputeId?: string | null;
    disputeStatus?: string | null;
    disputeReason?: string | null;
    disputeAmountMinor?: number | null;
    disputeOpenedAt?: TimestampString | null;
    disputeUpdatedAt?: TimestampString | null;
    disputeClosedAt?: TimestampString | null;
    webhookEventId?: string | null;
  } & TicketOrder_Key;
}
```
### Using `GetTicketOrderForWebhook`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getTicketOrderForWebhook, GetTicketOrderForWebhookVariables } from '@dataconnect/generated';

// The `GetTicketOrderForWebhook` query requires an argument of type `GetTicketOrderForWebhookVariables`:
const getTicketOrderForWebhookVars: GetTicketOrderForWebhookVariables = {
  id: ..., 
};

// Call the `getTicketOrderForWebhook()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getTicketOrderForWebhook(getTicketOrderForWebhookVars);
// Variables can be defined inline as well.
const { data } = await getTicketOrderForWebhook({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getTicketOrderForWebhook(dataConnect, getTicketOrderForWebhookVars);

console.log(data.ticketOrder);

// Or, you can use the `Promise` API.
getTicketOrderForWebhook(getTicketOrderForWebhookVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder);
});
```

### Using `GetTicketOrderForWebhook`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getTicketOrderForWebhookRef, GetTicketOrderForWebhookVariables } from '@dataconnect/generated';

// The `GetTicketOrderForWebhook` query requires an argument of type `GetTicketOrderForWebhookVariables`:
const getTicketOrderForWebhookVars: GetTicketOrderForWebhookVariables = {
  id: ..., 
};

// Call the `getTicketOrderForWebhookRef()` function to get a reference to the query.
const ref = getTicketOrderForWebhookRef(getTicketOrderForWebhookVars);
// Variables can be defined inline as well.
const ref = getTicketOrderForWebhookRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getTicketOrderForWebhookRef(dataConnect, getTicketOrderForWebhookVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.ticketOrder);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder);
});
```

## GetTicketOrderStripeArtifactsForCallable
You can execute the `GetTicketOrderStripeArtifactsForCallable` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getTicketOrderStripeArtifactsForCallable(vars: GetTicketOrderStripeArtifactsForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;

interface GetTicketOrderStripeArtifactsForCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTicketOrderStripeArtifactsForCallableVariables): QueryRef<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;
}
export const getTicketOrderStripeArtifactsForCallableRef: GetTicketOrderStripeArtifactsForCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getTicketOrderStripeArtifactsForCallable(dc: DataConnect, vars: GetTicketOrderStripeArtifactsForCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;

interface GetTicketOrderStripeArtifactsForCallableRef {
  ...
  (dc: DataConnect, vars: GetTicketOrderStripeArtifactsForCallableVariables): QueryRef<GetTicketOrderStripeArtifactsForCallableData, GetTicketOrderStripeArtifactsForCallableVariables>;
}
export const getTicketOrderStripeArtifactsForCallableRef: GetTicketOrderStripeArtifactsForCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getTicketOrderStripeArtifactsForCallableRef:
```typescript
const name = getTicketOrderStripeArtifactsForCallableRef.operationName;
console.log(name);
```

### Variables
The `GetTicketOrderStripeArtifactsForCallable` query requires an argument of type `GetTicketOrderStripeArtifactsForCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetTicketOrderStripeArtifactsForCallableVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetTicketOrderStripeArtifactsForCallable` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetTicketOrderStripeArtifactsForCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetTicketOrderStripeArtifactsForCallableData {
  ticketOrder?: {
    id: UUIDString;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    user: {
      id: string;
    } & User_Key;
  } & TicketOrder_Key;
}
```
### Using `GetTicketOrderStripeArtifactsForCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getTicketOrderStripeArtifactsForCallable, GetTicketOrderStripeArtifactsForCallableVariables } from '@dataconnect/generated';

// The `GetTicketOrderStripeArtifactsForCallable` query requires an argument of type `GetTicketOrderStripeArtifactsForCallableVariables`:
const getTicketOrderStripeArtifactsForCallableVars: GetTicketOrderStripeArtifactsForCallableVariables = {
  id: ..., 
};

// Call the `getTicketOrderStripeArtifactsForCallable()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getTicketOrderStripeArtifactsForCallable(getTicketOrderStripeArtifactsForCallableVars);
// Variables can be defined inline as well.
const { data } = await getTicketOrderStripeArtifactsForCallable({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getTicketOrderStripeArtifactsForCallable(dataConnect, getTicketOrderStripeArtifactsForCallableVars);

console.log(data.ticketOrder);

// Or, you can use the `Promise` API.
getTicketOrderStripeArtifactsForCallable(getTicketOrderStripeArtifactsForCallableVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder);
});
```

### Using `GetTicketOrderStripeArtifactsForCallable`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getTicketOrderStripeArtifactsForCallableRef, GetTicketOrderStripeArtifactsForCallableVariables } from '@dataconnect/generated';

// The `GetTicketOrderStripeArtifactsForCallable` query requires an argument of type `GetTicketOrderStripeArtifactsForCallableVariables`:
const getTicketOrderStripeArtifactsForCallableVars: GetTicketOrderStripeArtifactsForCallableVariables = {
  id: ..., 
};

// Call the `getTicketOrderStripeArtifactsForCallableRef()` function to get a reference to the query.
const ref = getTicketOrderStripeArtifactsForCallableRef(getTicketOrderStripeArtifactsForCallableVars);
// Variables can be defined inline as well.
const ref = getTicketOrderStripeArtifactsForCallableRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getTicketOrderStripeArtifactsForCallableRef(dataConnect, getTicketOrderStripeArtifactsForCallableVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.ticketOrder);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder);
});
```

## GetPaymentWebhookEventByStripeEventId
You can execute the `GetPaymentWebhookEventByStripeEventId` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getPaymentWebhookEventByStripeEventId(vars: GetPaymentWebhookEventByStripeEventIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;

interface GetPaymentWebhookEventByStripeEventIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryRef<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
}
export const getPaymentWebhookEventByStripeEventIdRef: GetPaymentWebhookEventByStripeEventIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getPaymentWebhookEventByStripeEventId(dc: DataConnect, vars: GetPaymentWebhookEventByStripeEventIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;

interface GetPaymentWebhookEventByStripeEventIdRef {
  ...
  (dc: DataConnect, vars: GetPaymentWebhookEventByStripeEventIdVariables): QueryRef<GetPaymentWebhookEventByStripeEventIdData, GetPaymentWebhookEventByStripeEventIdVariables>;
}
export const getPaymentWebhookEventByStripeEventIdRef: GetPaymentWebhookEventByStripeEventIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getPaymentWebhookEventByStripeEventIdRef:
```typescript
const name = getPaymentWebhookEventByStripeEventIdRef.operationName;
console.log(name);
```

### Variables
The `GetPaymentWebhookEventByStripeEventId` query requires an argument of type `GetPaymentWebhookEventByStripeEventIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetPaymentWebhookEventByStripeEventIdVariables {
  stripeEventId: string;
}
```
### Return Type
Recall that executing the `GetPaymentWebhookEventByStripeEventId` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetPaymentWebhookEventByStripeEventIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetPaymentWebhookEventByStripeEventIdData {
  paymentWebhookEvents: ({
    id: UUIDString;
    stripeEventId: string;
    eventType: string;
    outcome: PaymentWebhookEventOutcome;
    reason?: string | null;
    ticketOrder?: {
      id: UUIDString;
    } & TicketOrder_Key;
    stripeObjectId?: string | null;
    livemode: boolean;
    createdAt: TimestampString;
  } & PaymentWebhookEvent_Key)[];
}
```
### Using `GetPaymentWebhookEventByStripeEventId`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getPaymentWebhookEventByStripeEventId, GetPaymentWebhookEventByStripeEventIdVariables } from '@dataconnect/generated';

// The `GetPaymentWebhookEventByStripeEventId` query requires an argument of type `GetPaymentWebhookEventByStripeEventIdVariables`:
const getPaymentWebhookEventByStripeEventIdVars: GetPaymentWebhookEventByStripeEventIdVariables = {
  stripeEventId: ..., 
};

// Call the `getPaymentWebhookEventByStripeEventId()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getPaymentWebhookEventByStripeEventId(getPaymentWebhookEventByStripeEventIdVars);
// Variables can be defined inline as well.
const { data } = await getPaymentWebhookEventByStripeEventId({ stripeEventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getPaymentWebhookEventByStripeEventId(dataConnect, getPaymentWebhookEventByStripeEventIdVars);

console.log(data.paymentWebhookEvents);

// Or, you can use the `Promise` API.
getPaymentWebhookEventByStripeEventId(getPaymentWebhookEventByStripeEventIdVars).then((response) => {
  const data = response.data;
  console.log(data.paymentWebhookEvents);
});
```

### Using `GetPaymentWebhookEventByStripeEventId`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getPaymentWebhookEventByStripeEventIdRef, GetPaymentWebhookEventByStripeEventIdVariables } from '@dataconnect/generated';

// The `GetPaymentWebhookEventByStripeEventId` query requires an argument of type `GetPaymentWebhookEventByStripeEventIdVariables`:
const getPaymentWebhookEventByStripeEventIdVars: GetPaymentWebhookEventByStripeEventIdVariables = {
  stripeEventId: ..., 
};

// Call the `getPaymentWebhookEventByStripeEventIdRef()` function to get a reference to the query.
const ref = getPaymentWebhookEventByStripeEventIdRef(getPaymentWebhookEventByStripeEventIdVars);
// Variables can be defined inline as well.
const ref = getPaymentWebhookEventByStripeEventIdRef({ stripeEventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getPaymentWebhookEventByStripeEventIdRef(dataConnect, getPaymentWebhookEventByStripeEventIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.paymentWebhookEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.paymentWebhookEvents);
});
```

## GetNotificationDeliveryByChannelAndKey
You can execute the `GetNotificationDeliveryByChannelAndKey` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getNotificationDeliveryByChannelAndKey(vars: GetNotificationDeliveryByChannelAndKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;

interface GetNotificationDeliveryByChannelAndKeyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetNotificationDeliveryByChannelAndKeyVariables): QueryRef<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;
}
export const getNotificationDeliveryByChannelAndKeyRef: GetNotificationDeliveryByChannelAndKeyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getNotificationDeliveryByChannelAndKey(dc: DataConnect, vars: GetNotificationDeliveryByChannelAndKeyVariables, options?: ExecuteQueryOptions): QueryPromise<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;

interface GetNotificationDeliveryByChannelAndKeyRef {
  ...
  (dc: DataConnect, vars: GetNotificationDeliveryByChannelAndKeyVariables): QueryRef<GetNotificationDeliveryByChannelAndKeyData, GetNotificationDeliveryByChannelAndKeyVariables>;
}
export const getNotificationDeliveryByChannelAndKeyRef: GetNotificationDeliveryByChannelAndKeyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getNotificationDeliveryByChannelAndKeyRef:
```typescript
const name = getNotificationDeliveryByChannelAndKeyRef.operationName;
console.log(name);
```

### Variables
The `GetNotificationDeliveryByChannelAndKey` query requires an argument of type `GetNotificationDeliveryByChannelAndKeyVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetNotificationDeliveryByChannelAndKeyVariables {
  channel: NotificationChannel;
  deliveryKey: string;
}
```
### Return Type
Recall that executing the `GetNotificationDeliveryByChannelAndKey` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetNotificationDeliveryByChannelAndKeyData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetNotificationDeliveryByChannelAndKeyData {
  notificationDeliveries: ({
    id: UUIDString;
    channel: NotificationChannel;
    deliveryKey: string;
    notificationType: string;
    status: NotificationDeliveryStatus;
    provider?: string | null;
    providerMessageId?: string | null;
    attemptCount: number;
    lastAttemptedAt?: TimestampString | null;
    sentAt?: TimestampString | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    createdAt: TimestampString;
  } & NotificationDelivery_Key)[];
}
```
### Using `GetNotificationDeliveryByChannelAndKey`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getNotificationDeliveryByChannelAndKey, GetNotificationDeliveryByChannelAndKeyVariables } from '@dataconnect/generated';

// The `GetNotificationDeliveryByChannelAndKey` query requires an argument of type `GetNotificationDeliveryByChannelAndKeyVariables`:
const getNotificationDeliveryByChannelAndKeyVars: GetNotificationDeliveryByChannelAndKeyVariables = {
  channel: ..., 
  deliveryKey: ..., 
};

// Call the `getNotificationDeliveryByChannelAndKey()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getNotificationDeliveryByChannelAndKey(getNotificationDeliveryByChannelAndKeyVars);
// Variables can be defined inline as well.
const { data } = await getNotificationDeliveryByChannelAndKey({ channel: ..., deliveryKey: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getNotificationDeliveryByChannelAndKey(dataConnect, getNotificationDeliveryByChannelAndKeyVars);

console.log(data.notificationDeliveries);

// Or, you can use the `Promise` API.
getNotificationDeliveryByChannelAndKey(getNotificationDeliveryByChannelAndKeyVars).then((response) => {
  const data = response.data;
  console.log(data.notificationDeliveries);
});
```

### Using `GetNotificationDeliveryByChannelAndKey`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getNotificationDeliveryByChannelAndKeyRef, GetNotificationDeliveryByChannelAndKeyVariables } from '@dataconnect/generated';

// The `GetNotificationDeliveryByChannelAndKey` query requires an argument of type `GetNotificationDeliveryByChannelAndKeyVariables`:
const getNotificationDeliveryByChannelAndKeyVars: GetNotificationDeliveryByChannelAndKeyVariables = {
  channel: ..., 
  deliveryKey: ..., 
};

// Call the `getNotificationDeliveryByChannelAndKeyRef()` function to get a reference to the query.
const ref = getNotificationDeliveryByChannelAndKeyRef(getNotificationDeliveryByChannelAndKeyVars);
// Variables can be defined inline as well.
const ref = getNotificationDeliveryByChannelAndKeyRef({ channel: ..., deliveryKey: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getNotificationDeliveryByChannelAndKeyRef(dataConnect, getNotificationDeliveryByChannelAndKeyVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.notificationDeliveries);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.notificationDeliveries);
});
```

## GetPaymentReconciliationExceptionByOrderAndType
You can execute the `GetPaymentReconciliationExceptionByOrderAndType` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getPaymentReconciliationExceptionByOrderAndType(vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;

interface GetPaymentReconciliationExceptionByOrderAndTypeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables): QueryRef<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;
}
export const getPaymentReconciliationExceptionByOrderAndTypeRef: GetPaymentReconciliationExceptionByOrderAndTypeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getPaymentReconciliationExceptionByOrderAndType(dc: DataConnect, vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables, options?: ExecuteQueryOptions): QueryPromise<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;

interface GetPaymentReconciliationExceptionByOrderAndTypeRef {
  ...
  (dc: DataConnect, vars: GetPaymentReconciliationExceptionByOrderAndTypeVariables): QueryRef<GetPaymentReconciliationExceptionByOrderAndTypeData, GetPaymentReconciliationExceptionByOrderAndTypeVariables>;
}
export const getPaymentReconciliationExceptionByOrderAndTypeRef: GetPaymentReconciliationExceptionByOrderAndTypeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getPaymentReconciliationExceptionByOrderAndTypeRef:
```typescript
const name = getPaymentReconciliationExceptionByOrderAndTypeRef.operationName;
console.log(name);
```

### Variables
The `GetPaymentReconciliationExceptionByOrderAndType` query requires an argument of type `GetPaymentReconciliationExceptionByOrderAndTypeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetPaymentReconciliationExceptionByOrderAndTypeVariables {
  ticketOrderId: UUIDString;
  exceptionType: PaymentReconciliationExceptionType;
}
```
### Return Type
Recall that executing the `GetPaymentReconciliationExceptionByOrderAndType` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetPaymentReconciliationExceptionByOrderAndTypeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetPaymentReconciliationExceptionByOrderAndTypeData {
  paymentReconciliationExceptions: ({
    id: UUIDString;
    status: PaymentReconciliationExceptionStatus;
  } & PaymentReconciliationException_Key)[];
}
```
### Using `GetPaymentReconciliationExceptionByOrderAndType`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getPaymentReconciliationExceptionByOrderAndType, GetPaymentReconciliationExceptionByOrderAndTypeVariables } from '@dataconnect/generated';

// The `GetPaymentReconciliationExceptionByOrderAndType` query requires an argument of type `GetPaymentReconciliationExceptionByOrderAndTypeVariables`:
const getPaymentReconciliationExceptionByOrderAndTypeVars: GetPaymentReconciliationExceptionByOrderAndTypeVariables = {
  ticketOrderId: ..., 
  exceptionType: ..., 
};

// Call the `getPaymentReconciliationExceptionByOrderAndType()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getPaymentReconciliationExceptionByOrderAndType(getPaymentReconciliationExceptionByOrderAndTypeVars);
// Variables can be defined inline as well.
const { data } = await getPaymentReconciliationExceptionByOrderAndType({ ticketOrderId: ..., exceptionType: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getPaymentReconciliationExceptionByOrderAndType(dataConnect, getPaymentReconciliationExceptionByOrderAndTypeVars);

console.log(data.paymentReconciliationExceptions);

// Or, you can use the `Promise` API.
getPaymentReconciliationExceptionByOrderAndType(getPaymentReconciliationExceptionByOrderAndTypeVars).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationExceptions);
});
```

### Using `GetPaymentReconciliationExceptionByOrderAndType`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getPaymentReconciliationExceptionByOrderAndTypeRef, GetPaymentReconciliationExceptionByOrderAndTypeVariables } from '@dataconnect/generated';

// The `GetPaymentReconciliationExceptionByOrderAndType` query requires an argument of type `GetPaymentReconciliationExceptionByOrderAndTypeVariables`:
const getPaymentReconciliationExceptionByOrderAndTypeVars: GetPaymentReconciliationExceptionByOrderAndTypeVariables = {
  ticketOrderId: ..., 
  exceptionType: ..., 
};

// Call the `getPaymentReconciliationExceptionByOrderAndTypeRef()` function to get a reference to the query.
const ref = getPaymentReconciliationExceptionByOrderAndTypeRef(getPaymentReconciliationExceptionByOrderAndTypeVars);
// Variables can be defined inline as well.
const ref = getPaymentReconciliationExceptionByOrderAndTypeRef({ ticketOrderId: ..., exceptionType: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getPaymentReconciliationExceptionByOrderAndTypeRef(dataConnect, getPaymentReconciliationExceptionByOrderAndTypeVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.paymentReconciliationExceptions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationExceptions);
});
```

## GetBookingForGuestTicketCallable
You can execute the `GetBookingForGuestTicketCallable` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getBookingForGuestTicketCallable(vars: GetBookingForGuestTicketCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;

interface GetBookingForGuestTicketCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBookingForGuestTicketCallableVariables): QueryRef<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;
}
export const getBookingForGuestTicketCallableRef: GetBookingForGuestTicketCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getBookingForGuestTicketCallable(dc: DataConnect, vars: GetBookingForGuestTicketCallableVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;

interface GetBookingForGuestTicketCallableRef {
  ...
  (dc: DataConnect, vars: GetBookingForGuestTicketCallableVariables): QueryRef<GetBookingForGuestTicketCallableData, GetBookingForGuestTicketCallableVariables>;
}
export const getBookingForGuestTicketCallableRef: GetBookingForGuestTicketCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getBookingForGuestTicketCallableRef:
```typescript
const name = getBookingForGuestTicketCallableRef.operationName;
console.log(name);
```

### Variables
The `GetBookingForGuestTicketCallable` query requires an argument of type `GetBookingForGuestTicketCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetBookingForGuestTicketCallableVariables {
  bookingId: UUIDString;
}
```
### Return Type
Recall that executing the `GetBookingForGuestTicketCallable` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetBookingForGuestTicketCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetBookingForGuestTicketCallableData {
  booking?: {
    id: UUIDString;
    booker: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } & User_Key;
    event: {
      id: UUIDString;
      title: string;
      section: {
        id: UUIDString;
        name: string;
      } & Section_Key;
    } & Event_Key;
    supersedesBooking?: {
      guestTicketRequests: ({
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        guestTicketType?: {
          id: UUIDString;
        } & TicketType_Key;
        reviewedBy?: {
          id: string;
        } & User_Key;
        reviewedAt?: TimestampString | null;
        moderatorNote?: string | null;
      })[];
    };
    guestTicketRequests: ({
      status: GuestTicketRequestStatus;
      requestedGuestCount: number;
      guestDisplayName?: string | null;
      guestTicketType?: {
        id: UUIDString;
      } & TicketType_Key;
    })[];
  } & Booking_Key;
}
```
### Using `GetBookingForGuestTicketCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getBookingForGuestTicketCallable, GetBookingForGuestTicketCallableVariables } from '@dataconnect/generated';

// The `GetBookingForGuestTicketCallable` query requires an argument of type `GetBookingForGuestTicketCallableVariables`:
const getBookingForGuestTicketCallableVars: GetBookingForGuestTicketCallableVariables = {
  bookingId: ..., 
};

// Call the `getBookingForGuestTicketCallable()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getBookingForGuestTicketCallable(getBookingForGuestTicketCallableVars);
// Variables can be defined inline as well.
const { data } = await getBookingForGuestTicketCallable({ bookingId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getBookingForGuestTicketCallable(dataConnect, getBookingForGuestTicketCallableVars);

console.log(data.booking);

// Or, you can use the `Promise` API.
getBookingForGuestTicketCallable(getBookingForGuestTicketCallableVars).then((response) => {
  const data = response.data;
  console.log(data.booking);
});
```

### Using `GetBookingForGuestTicketCallable`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getBookingForGuestTicketCallableRef, GetBookingForGuestTicketCallableVariables } from '@dataconnect/generated';

// The `GetBookingForGuestTicketCallable` query requires an argument of type `GetBookingForGuestTicketCallableVariables`:
const getBookingForGuestTicketCallableVars: GetBookingForGuestTicketCallableVariables = {
  bookingId: ..., 
};

// Call the `getBookingForGuestTicketCallableRef()` function to get a reference to the query.
const ref = getBookingForGuestTicketCallableRef(getBookingForGuestTicketCallableVars);
// Variables can be defined inline as well.
const ref = getBookingForGuestTicketCallableRef({ bookingId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getBookingForGuestTicketCallableRef(dataConnect, getBookingForGuestTicketCallableVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.booking);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.booking);
});
```

## GetBookingForNotification
You can execute the `GetBookingForNotification` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getBookingForNotification(vars: GetBookingForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForNotificationData, GetBookingForNotificationVariables>;

interface GetBookingForNotificationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetBookingForNotificationVariables): QueryRef<GetBookingForNotificationData, GetBookingForNotificationVariables>;
}
export const getBookingForNotificationRef: GetBookingForNotificationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getBookingForNotification(dc: DataConnect, vars: GetBookingForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetBookingForNotificationData, GetBookingForNotificationVariables>;

interface GetBookingForNotificationRef {
  ...
  (dc: DataConnect, vars: GetBookingForNotificationVariables): QueryRef<GetBookingForNotificationData, GetBookingForNotificationVariables>;
}
export const getBookingForNotificationRef: GetBookingForNotificationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getBookingForNotificationRef:
```typescript
const name = getBookingForNotificationRef.operationName;
console.log(name);
```

### Variables
The `GetBookingForNotification` query requires an argument of type `GetBookingForNotificationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetBookingForNotificationVariables {
  bookingId: UUIDString;
}
```
### Return Type
Recall that executing the `GetBookingForNotification` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetBookingForNotificationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetBookingForNotificationData {
  booking?: {
    id: UUIDString;
    revisionNumber: number;
    bookerDietaryNote?: string | null;
    sitNextToUserIds?: string[] | null;
    accommodationRequested: boolean;
    accommodationNote?: string | null;
    booker: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } & User_Key;
    event: {
      id: UUIDString;
      title: string;
      location?: string | null;
      startDateTime: TimestampString;
      endDateTime: TimestampString;
      section: {
        id: UUIDString;
        name: string;
      } & Section_Key;
    } & Event_Key;
    lines: ({
      sortOrder: number;
      guestDisplayName?: string | null;
      dietaryNote?: string | null;
      ticketType: {
        title: string;
        audience: TicketAudience;
        price: number;
      };
      guestUser?: {
        firstName: string;
        lastName: string;
      };
    })[];
    supersedesBooking?: {
      id: UUIDString;
      revisionNumber: number;
    } & Booking_Key;
  } & Booking_Key;
}
```
### Using `GetBookingForNotification`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getBookingForNotification, GetBookingForNotificationVariables } from '@dataconnect/generated';

// The `GetBookingForNotification` query requires an argument of type `GetBookingForNotificationVariables`:
const getBookingForNotificationVars: GetBookingForNotificationVariables = {
  bookingId: ..., 
};

// Call the `getBookingForNotification()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getBookingForNotification(getBookingForNotificationVars);
// Variables can be defined inline as well.
const { data } = await getBookingForNotification({ bookingId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getBookingForNotification(dataConnect, getBookingForNotificationVars);

console.log(data.booking);

// Or, you can use the `Promise` API.
getBookingForNotification(getBookingForNotificationVars).then((response) => {
  const data = response.data;
  console.log(data.booking);
});
```

### Using `GetBookingForNotification`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getBookingForNotificationRef, GetBookingForNotificationVariables } from '@dataconnect/generated';

// The `GetBookingForNotification` query requires an argument of type `GetBookingForNotificationVariables`:
const getBookingForNotificationVars: GetBookingForNotificationVariables = {
  bookingId: ..., 
};

// Call the `getBookingForNotificationRef()` function to get a reference to the query.
const ref = getBookingForNotificationRef(getBookingForNotificationVars);
// Variables can be defined inline as well.
const ref = getBookingForNotificationRef({ bookingId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getBookingForNotificationRef(dataConnect, getBookingForNotificationVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.booking);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.booking);
});
```

## ListStaleDraftBookingsForScheduler
You can execute the `ListStaleDraftBookingsForScheduler` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listStaleDraftBookingsForScheduler(vars: ListStaleDraftBookingsForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;

interface ListStaleDraftBookingsForSchedulerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaleDraftBookingsForSchedulerVariables): QueryRef<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;
}
export const listStaleDraftBookingsForSchedulerRef: ListStaleDraftBookingsForSchedulerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listStaleDraftBookingsForScheduler(dc: DataConnect, vars: ListStaleDraftBookingsForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;

interface ListStaleDraftBookingsForSchedulerRef {
  ...
  (dc: DataConnect, vars: ListStaleDraftBookingsForSchedulerVariables): QueryRef<ListStaleDraftBookingsForSchedulerData, ListStaleDraftBookingsForSchedulerVariables>;
}
export const listStaleDraftBookingsForSchedulerRef: ListStaleDraftBookingsForSchedulerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listStaleDraftBookingsForSchedulerRef:
```typescript
const name = listStaleDraftBookingsForSchedulerRef.operationName;
console.log(name);
```

### Variables
The `ListStaleDraftBookingsForScheduler` query requires an argument of type `ListStaleDraftBookingsForSchedulerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListStaleDraftBookingsForSchedulerVariables {
  updatedBefore: TimestampString;
  limit: number;
}
```
### Return Type
Recall that executing the `ListStaleDraftBookingsForScheduler` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListStaleDraftBookingsForSchedulerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListStaleDraftBookingsForSchedulerData {
  bookings: ({
    id: UUIDString;
    status: BookingStatus;
    updatedAt: TimestampString;
  } & Booking_Key)[];
}
```
### Using `ListStaleDraftBookingsForScheduler`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listStaleDraftBookingsForScheduler, ListStaleDraftBookingsForSchedulerVariables } from '@dataconnect/generated';

// The `ListStaleDraftBookingsForScheduler` query requires an argument of type `ListStaleDraftBookingsForSchedulerVariables`:
const listStaleDraftBookingsForSchedulerVars: ListStaleDraftBookingsForSchedulerVariables = {
  updatedBefore: ..., 
  limit: ..., 
};

// Call the `listStaleDraftBookingsForScheduler()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listStaleDraftBookingsForScheduler(listStaleDraftBookingsForSchedulerVars);
// Variables can be defined inline as well.
const { data } = await listStaleDraftBookingsForScheduler({ updatedBefore: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listStaleDraftBookingsForScheduler(dataConnect, listStaleDraftBookingsForSchedulerVars);

console.log(data.bookings);

// Or, you can use the `Promise` API.
listStaleDraftBookingsForScheduler(listStaleDraftBookingsForSchedulerVars).then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

### Using `ListStaleDraftBookingsForScheduler`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listStaleDraftBookingsForSchedulerRef, ListStaleDraftBookingsForSchedulerVariables } from '@dataconnect/generated';

// The `ListStaleDraftBookingsForScheduler` query requires an argument of type `ListStaleDraftBookingsForSchedulerVariables`:
const listStaleDraftBookingsForSchedulerVars: ListStaleDraftBookingsForSchedulerVariables = {
  updatedBefore: ..., 
  limit: ..., 
};

// Call the `listStaleDraftBookingsForSchedulerRef()` function to get a reference to the query.
const ref = listStaleDraftBookingsForSchedulerRef(listStaleDraftBookingsForSchedulerVars);
// Variables can be defined inline as well.
const ref = listStaleDraftBookingsForSchedulerRef({ updatedBefore: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listStaleDraftBookingsForSchedulerRef(dataConnect, listStaleDraftBookingsForSchedulerVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.bookings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

## ListStalePendingTicketOrdersForScheduler
You can execute the `ListStalePendingTicketOrdersForScheduler` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listStalePendingTicketOrdersForScheduler(vars: ListStalePendingTicketOrdersForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;

interface ListStalePendingTicketOrdersForSchedulerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStalePendingTicketOrdersForSchedulerVariables): QueryRef<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;
}
export const listStalePendingTicketOrdersForSchedulerRef: ListStalePendingTicketOrdersForSchedulerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listStalePendingTicketOrdersForScheduler(dc: DataConnect, vars: ListStalePendingTicketOrdersForSchedulerVariables, options?: ExecuteQueryOptions): QueryPromise<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;

interface ListStalePendingTicketOrdersForSchedulerRef {
  ...
  (dc: DataConnect, vars: ListStalePendingTicketOrdersForSchedulerVariables): QueryRef<ListStalePendingTicketOrdersForSchedulerData, ListStalePendingTicketOrdersForSchedulerVariables>;
}
export const listStalePendingTicketOrdersForSchedulerRef: ListStalePendingTicketOrdersForSchedulerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listStalePendingTicketOrdersForSchedulerRef:
```typescript
const name = listStalePendingTicketOrdersForSchedulerRef.operationName;
console.log(name);
```

### Variables
The `ListStalePendingTicketOrdersForScheduler` query requires an argument of type `ListStalePendingTicketOrdersForSchedulerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListStalePendingTicketOrdersForSchedulerVariables {
  createdBefore: TimestampString;
  limit: number;
}
```
### Return Type
Recall that executing the `ListStalePendingTicketOrdersForScheduler` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListStalePendingTicketOrdersForSchedulerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListStalePendingTicketOrdersForSchedulerData {
  ticketOrders: ({
    id: UUIDString;
    status: TicketOrderStatus;
    createdAt: TimestampString;
  } & TicketOrder_Key)[];
}
```
### Using `ListStalePendingTicketOrdersForScheduler`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listStalePendingTicketOrdersForScheduler, ListStalePendingTicketOrdersForSchedulerVariables } from '@dataconnect/generated';

// The `ListStalePendingTicketOrdersForScheduler` query requires an argument of type `ListStalePendingTicketOrdersForSchedulerVariables`:
const listStalePendingTicketOrdersForSchedulerVars: ListStalePendingTicketOrdersForSchedulerVariables = {
  createdBefore: ..., 
  limit: ..., 
};

// Call the `listStalePendingTicketOrdersForScheduler()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listStalePendingTicketOrdersForScheduler(listStalePendingTicketOrdersForSchedulerVars);
// Variables can be defined inline as well.
const { data } = await listStalePendingTicketOrdersForScheduler({ createdBefore: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listStalePendingTicketOrdersForScheduler(dataConnect, listStalePendingTicketOrdersForSchedulerVars);

console.log(data.ticketOrders);

// Or, you can use the `Promise` API.
listStalePendingTicketOrdersForScheduler(listStalePendingTicketOrdersForSchedulerVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrders);
});
```

### Using `ListStalePendingTicketOrdersForScheduler`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listStalePendingTicketOrdersForSchedulerRef, ListStalePendingTicketOrdersForSchedulerVariables } from '@dataconnect/generated';

// The `ListStalePendingTicketOrdersForScheduler` query requires an argument of type `ListStalePendingTicketOrdersForSchedulerVariables`:
const listStalePendingTicketOrdersForSchedulerVars: ListStalePendingTicketOrdersForSchedulerVariables = {
  createdBefore: ..., 
  limit: ..., 
};

// Call the `listStalePendingTicketOrdersForSchedulerRef()` function to get a reference to the query.
const ref = listStalePendingTicketOrdersForSchedulerRef(listStalePendingTicketOrdersForSchedulerVars);
// Variables can be defined inline as well.
const ref = listStalePendingTicketOrdersForSchedulerRef({ createdBefore: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listStalePendingTicketOrdersForSchedulerRef(dataConnect, listStalePendingTicketOrdersForSchedulerVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.ticketOrders);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrders);
});
```

## GetGuestTicketRequestForNotification
You can execute the `GetGuestTicketRequestForNotification` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getGuestTicketRequestForNotification(vars: GetGuestTicketRequestForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;

interface GetGuestTicketRequestForNotificationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGuestTicketRequestForNotificationVariables): QueryRef<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;
}
export const getGuestTicketRequestForNotificationRef: GetGuestTicketRequestForNotificationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getGuestTicketRequestForNotification(dc: DataConnect, vars: GetGuestTicketRequestForNotificationVariables, options?: ExecuteQueryOptions): QueryPromise<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;

interface GetGuestTicketRequestForNotificationRef {
  ...
  (dc: DataConnect, vars: GetGuestTicketRequestForNotificationVariables): QueryRef<GetGuestTicketRequestForNotificationData, GetGuestTicketRequestForNotificationVariables>;
}
export const getGuestTicketRequestForNotificationRef: GetGuestTicketRequestForNotificationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getGuestTicketRequestForNotificationRef:
```typescript
const name = getGuestTicketRequestForNotificationRef.operationName;
console.log(name);
```

### Variables
The `GetGuestTicketRequestForNotification` query requires an argument of type `GetGuestTicketRequestForNotificationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetGuestTicketRequestForNotificationVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetGuestTicketRequestForNotification` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetGuestTicketRequestForNotificationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetGuestTicketRequestForNotificationData {
  guestTicketRequest?: {
    id: UUIDString;
    status: GuestTicketRequestStatus;
    requestedGuestCount: number;
    guestDisplayName?: string | null;
    dietaryNote?: string | null;
    moderatorNote?: string | null;
    guestTicketType?: {
      id: UUIDString;
      title: string;
    } & TicketType_Key;
    booking: {
      id: UUIDString;
      booker: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      event: {
        id: UUIDString;
        title: string;
        section: {
          id: UUIDString;
          name: string;
        } & Section_Key;
      } & Event_Key;
    } & Booking_Key;
  } & GuestTicketRequest_Key;
}
```
### Using `GetGuestTicketRequestForNotification`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getGuestTicketRequestForNotification, GetGuestTicketRequestForNotificationVariables } from '@dataconnect/generated';

// The `GetGuestTicketRequestForNotification` query requires an argument of type `GetGuestTicketRequestForNotificationVariables`:
const getGuestTicketRequestForNotificationVars: GetGuestTicketRequestForNotificationVariables = {
  id: ..., 
};

// Call the `getGuestTicketRequestForNotification()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getGuestTicketRequestForNotification(getGuestTicketRequestForNotificationVars);
// Variables can be defined inline as well.
const { data } = await getGuestTicketRequestForNotification({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getGuestTicketRequestForNotification(dataConnect, getGuestTicketRequestForNotificationVars);

console.log(data.guestTicketRequest);

// Or, you can use the `Promise` API.
getGuestTicketRequestForNotification(getGuestTicketRequestForNotificationVars).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest);
});
```

### Using `GetGuestTicketRequestForNotification`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getGuestTicketRequestForNotificationRef, GetGuestTicketRequestForNotificationVariables } from '@dataconnect/generated';

// The `GetGuestTicketRequestForNotification` query requires an argument of type `GetGuestTicketRequestForNotificationVariables`:
const getGuestTicketRequestForNotificationVars: GetGuestTicketRequestForNotificationVariables = {
  id: ..., 
};

// Call the `getGuestTicketRequestForNotificationRef()` function to get a reference to the query.
const ref = getGuestTicketRequestForNotificationRef(getGuestTicketRequestForNotificationVars);
// Variables can be defined inline as well.
const ref = getGuestTicketRequestForNotificationRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getGuestTicketRequestForNotificationRef(dataConnect, getGuestTicketRequestForNotificationVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.guestTicketRequest);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest);
});
```

## GetSectionAnnouncementOptOuts
You can execute the `GetSectionAnnouncementOptOuts` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSectionAnnouncementOptOuts(vars: GetSectionAnnouncementOptOutsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;

interface GetSectionAnnouncementOptOutsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionAnnouncementOptOutsVariables): QueryRef<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;
}
export const getSectionAnnouncementOptOutsRef: GetSectionAnnouncementOptOutsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionAnnouncementOptOuts(dc: DataConnect, vars: GetSectionAnnouncementOptOutsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;

interface GetSectionAnnouncementOptOutsRef {
  ...
  (dc: DataConnect, vars: GetSectionAnnouncementOptOutsVariables): QueryRef<GetSectionAnnouncementOptOutsData, GetSectionAnnouncementOptOutsVariables>;
}
export const getSectionAnnouncementOptOutsRef: GetSectionAnnouncementOptOutsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSectionAnnouncementOptOutsRef:
```typescript
const name = getSectionAnnouncementOptOutsRef.operationName;
console.log(name);
```

### Variables
The `GetSectionAnnouncementOptOuts` query requires an argument of type `GetSectionAnnouncementOptOutsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSectionAnnouncementOptOutsVariables {
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `GetSectionAnnouncementOptOuts` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSectionAnnouncementOptOutsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSectionAnnouncementOptOutsData {
  sectionAnnouncementOptOuts: ({
    user: {
      id: string;
    } & User_Key;
  })[];
}
```
### Using `GetSectionAnnouncementOptOuts`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSectionAnnouncementOptOuts, GetSectionAnnouncementOptOutsVariables } from '@dataconnect/generated';

// The `GetSectionAnnouncementOptOuts` query requires an argument of type `GetSectionAnnouncementOptOutsVariables`:
const getSectionAnnouncementOptOutsVars: GetSectionAnnouncementOptOutsVariables = {
  sectionId: ..., 
};

// Call the `getSectionAnnouncementOptOuts()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSectionAnnouncementOptOuts(getSectionAnnouncementOptOutsVars);
// Variables can be defined inline as well.
const { data } = await getSectionAnnouncementOptOuts({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSectionAnnouncementOptOuts(dataConnect, getSectionAnnouncementOptOutsVars);

console.log(data.sectionAnnouncementOptOuts);

// Or, you can use the `Promise` API.
getSectionAnnouncementOptOuts(getSectionAnnouncementOptOutsVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOuts);
});
```

### Using `GetSectionAnnouncementOptOuts`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSectionAnnouncementOptOutsRef, GetSectionAnnouncementOptOutsVariables } from '@dataconnect/generated';

// The `GetSectionAnnouncementOptOuts` query requires an argument of type `GetSectionAnnouncementOptOutsVariables`:
const getSectionAnnouncementOptOutsVars: GetSectionAnnouncementOptOutsVariables = {
  sectionId: ..., 
};

// Call the `getSectionAnnouncementOptOutsRef()` function to get a reference to the query.
const ref = getSectionAnnouncementOptOutsRef(getSectionAnnouncementOptOutsVars);
// Variables can be defined inline as well.
const ref = getSectionAnnouncementOptOutsRef({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSectionAnnouncementOptOutsRef(dataConnect, getSectionAnnouncementOptOutsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sectionAnnouncementOptOuts);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOuts);
});
```

## GetAnnouncementRecipientCount
You can execute the `GetAnnouncementRecipientCount` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAnnouncementRecipientCount(vars: GetAnnouncementRecipientCountVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientCountData, GetAnnouncementRecipientCountVariables>;

interface GetAnnouncementRecipientCountRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementRecipientCountVariables): QueryRef<GetAnnouncementRecipientCountData, GetAnnouncementRecipientCountVariables>;
}
export const getAnnouncementRecipientCountRef: GetAnnouncementRecipientCountRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAnnouncementRecipientCount(dc: DataConnect, vars: GetAnnouncementRecipientCountVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementRecipientCountData, GetAnnouncementRecipientCountVariables>;

interface GetAnnouncementRecipientCountRef {
  ...
  (dc: DataConnect, vars: GetAnnouncementRecipientCountVariables): QueryRef<GetAnnouncementRecipientCountData, GetAnnouncementRecipientCountVariables>;
}
export const getAnnouncementRecipientCountRef: GetAnnouncementRecipientCountRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAnnouncementRecipientCountRef:
```typescript
const name = getAnnouncementRecipientCountRef.operationName;
console.log(name);
```

### Variables
The `GetAnnouncementRecipientCount` query requires an argument of type `GetAnnouncementRecipientCountVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAnnouncementRecipientCountVariables {
  sendId: UUIDString;
}
```
### Return Type
Recall that executing the `GetAnnouncementRecipientCount` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAnnouncementRecipientCountData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAnnouncementRecipientCountData {
  announcementRecipients: ({
    id: UUIDString;
  } & AnnouncementRecipient_Key)[];
}
```
### Using `GetAnnouncementRecipientCount`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementRecipientCount, GetAnnouncementRecipientCountVariables } from '@dataconnect/generated';

// The `GetAnnouncementRecipientCount` query requires an argument of type `GetAnnouncementRecipientCountVariables`:
const getAnnouncementRecipientCountVars: GetAnnouncementRecipientCountVariables = {
  sendId: ..., 
};

// Call the `getAnnouncementRecipientCount()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAnnouncementRecipientCount(getAnnouncementRecipientCountVars);
// Variables can be defined inline as well.
const { data } = await getAnnouncementRecipientCount({ sendId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAnnouncementRecipientCount(dataConnect, getAnnouncementRecipientCountVars);

console.log(data.announcementRecipients);

// Or, you can use the `Promise` API.
getAnnouncementRecipientCount(getAnnouncementRecipientCountVars).then((response) => {
  const data = response.data;
  console.log(data.announcementRecipients);
});
```

### Using `GetAnnouncementRecipientCount`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementRecipientCountRef, GetAnnouncementRecipientCountVariables } from '@dataconnect/generated';

// The `GetAnnouncementRecipientCount` query requires an argument of type `GetAnnouncementRecipientCountVariables`:
const getAnnouncementRecipientCountVars: GetAnnouncementRecipientCountVariables = {
  sendId: ..., 
};

// Call the `getAnnouncementRecipientCountRef()` function to get a reference to the query.
const ref = getAnnouncementRecipientCountRef(getAnnouncementRecipientCountVars);
// Variables can be defined inline as well.
const ref = getAnnouncementRecipientCountRef({ sendId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAnnouncementRecipientCountRef(dataConnect, getAnnouncementRecipientCountVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.announcementRecipients);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.announcementRecipients);
});
```

## GetAnnouncementSendHistory
You can execute the `GetAnnouncementSendHistory` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAnnouncementSendHistory(vars: GetAnnouncementSendHistoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;

interface GetAnnouncementSendHistoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementSendHistoryVariables): QueryRef<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;
}
export const getAnnouncementSendHistoryRef: GetAnnouncementSendHistoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAnnouncementSendHistory(dc: DataConnect, vars: GetAnnouncementSendHistoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;

interface GetAnnouncementSendHistoryRef {
  ...
  (dc: DataConnect, vars: GetAnnouncementSendHistoryVariables): QueryRef<GetAnnouncementSendHistoryData, GetAnnouncementSendHistoryVariables>;
}
export const getAnnouncementSendHistoryRef: GetAnnouncementSendHistoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAnnouncementSendHistoryRef:
```typescript
const name = getAnnouncementSendHistoryRef.operationName;
console.log(name);
```

### Variables
The `GetAnnouncementSendHistory` query requires an argument of type `GetAnnouncementSendHistoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAnnouncementSendHistoryVariables {
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `GetAnnouncementSendHistory` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAnnouncementSendHistoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAnnouncementSendHistoryData {
  announcementSends: ({
    id: UUIDString;
    templateUuid: string;
    templateName?: string | null;
    sentBy: string;
    sentAt: TimestampString;
    recipientCount: number;
    skippedCount: number;
    failureCount: number;
  } & AnnouncementSend_Key)[];
}
```
### Using `GetAnnouncementSendHistory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementSendHistory, GetAnnouncementSendHistoryVariables } from '@dataconnect/generated';

// The `GetAnnouncementSendHistory` query requires an argument of type `GetAnnouncementSendHistoryVariables`:
const getAnnouncementSendHistoryVars: GetAnnouncementSendHistoryVariables = {
  sectionId: ..., 
};

// Call the `getAnnouncementSendHistory()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAnnouncementSendHistory(getAnnouncementSendHistoryVars);
// Variables can be defined inline as well.
const { data } = await getAnnouncementSendHistory({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAnnouncementSendHistory(dataConnect, getAnnouncementSendHistoryVars);

console.log(data.announcementSends);

// Or, you can use the `Promise` API.
getAnnouncementSendHistory(getAnnouncementSendHistoryVars).then((response) => {
  const data = response.data;
  console.log(data.announcementSends);
});
```

### Using `GetAnnouncementSendHistory`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementSendHistoryRef, GetAnnouncementSendHistoryVariables } from '@dataconnect/generated';

// The `GetAnnouncementSendHistory` query requires an argument of type `GetAnnouncementSendHistoryVariables`:
const getAnnouncementSendHistoryVars: GetAnnouncementSendHistoryVariables = {
  sectionId: ..., 
};

// Call the `getAnnouncementSendHistoryRef()` function to get a reference to the query.
const ref = getAnnouncementSendHistoryRef(getAnnouncementSendHistoryVars);
// Variables can be defined inline as well.
const ref = getAnnouncementSendHistoryRef({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAnnouncementSendHistoryRef(dataConnect, getAnnouncementSendHistoryVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.announcementSends);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.announcementSends);
});
```

## GetAnnouncementSendRecipients
You can execute the `GetAnnouncementSendRecipients` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAnnouncementSendRecipients(vars: GetAnnouncementSendRecipientsVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;

interface GetAnnouncementSendRecipientsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementSendRecipientsVariables): QueryRef<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;
}
export const getAnnouncementSendRecipientsRef: GetAnnouncementSendRecipientsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAnnouncementSendRecipients(dc: DataConnect, vars: GetAnnouncementSendRecipientsVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;

interface GetAnnouncementSendRecipientsRef {
  ...
  (dc: DataConnect, vars: GetAnnouncementSendRecipientsVariables): QueryRef<GetAnnouncementSendRecipientsData, GetAnnouncementSendRecipientsVariables>;
}
export const getAnnouncementSendRecipientsRef: GetAnnouncementSendRecipientsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAnnouncementSendRecipientsRef:
```typescript
const name = getAnnouncementSendRecipientsRef.operationName;
console.log(name);
```

### Variables
The `GetAnnouncementSendRecipients` query requires an argument of type `GetAnnouncementSendRecipientsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAnnouncementSendRecipientsVariables {
  sendId: UUIDString;
}
```
### Return Type
Recall that executing the `GetAnnouncementSendRecipients` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAnnouncementSendRecipientsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAnnouncementSendRecipientsData {
  announcementRecipients: ({
    id: UUIDString;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    skippedReason?: string | null;
    sentAt?: TimestampString | null;
    failureReason?: string | null;
  } & AnnouncementRecipient_Key)[];
}
```
### Using `GetAnnouncementSendRecipients`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementSendRecipients, GetAnnouncementSendRecipientsVariables } from '@dataconnect/generated';

// The `GetAnnouncementSendRecipients` query requires an argument of type `GetAnnouncementSendRecipientsVariables`:
const getAnnouncementSendRecipientsVars: GetAnnouncementSendRecipientsVariables = {
  sendId: ..., 
};

// Call the `getAnnouncementSendRecipients()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAnnouncementSendRecipients(getAnnouncementSendRecipientsVars);
// Variables can be defined inline as well.
const { data } = await getAnnouncementSendRecipients({ sendId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAnnouncementSendRecipients(dataConnect, getAnnouncementSendRecipientsVars);

console.log(data.announcementRecipients);

// Or, you can use the `Promise` API.
getAnnouncementSendRecipients(getAnnouncementSendRecipientsVars).then((response) => {
  const data = response.data;
  console.log(data.announcementRecipients);
});
```

### Using `GetAnnouncementSendRecipients`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementSendRecipientsRef, GetAnnouncementSendRecipientsVariables } from '@dataconnect/generated';

// The `GetAnnouncementSendRecipients` query requires an argument of type `GetAnnouncementSendRecipientsVariables`:
const getAnnouncementSendRecipientsVars: GetAnnouncementSendRecipientsVariables = {
  sendId: ..., 
};

// Call the `getAnnouncementSendRecipientsRef()` function to get a reference to the query.
const ref = getAnnouncementSendRecipientsRef(getAnnouncementSendRecipientsVars);
// Variables can be defined inline as well.
const ref = getAnnouncementSendRecipientsRef({ sendId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAnnouncementSendRecipientsRef(dataConnect, getAnnouncementSendRecipientsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.announcementRecipients);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.announcementRecipients);
});
```

## GetAnnouncementSendById
You can execute the `GetAnnouncementSendById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAnnouncementSendById(vars: GetAnnouncementSendByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;

interface GetAnnouncementSendByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAnnouncementSendByIdVariables): QueryRef<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;
}
export const getAnnouncementSendByIdRef: GetAnnouncementSendByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAnnouncementSendById(dc: DataConnect, vars: GetAnnouncementSendByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;

interface GetAnnouncementSendByIdRef {
  ...
  (dc: DataConnect, vars: GetAnnouncementSendByIdVariables): QueryRef<GetAnnouncementSendByIdData, GetAnnouncementSendByIdVariables>;
}
export const getAnnouncementSendByIdRef: GetAnnouncementSendByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAnnouncementSendByIdRef:
```typescript
const name = getAnnouncementSendByIdRef.operationName;
console.log(name);
```

### Variables
The `GetAnnouncementSendById` query requires an argument of type `GetAnnouncementSendByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetAnnouncementSendByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetAnnouncementSendById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAnnouncementSendByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAnnouncementSendByIdData {
  announcementSend?: {
    id: UUIDString;
    sectionId: UUIDString;
  } & AnnouncementSend_Key;
}
```
### Using `GetAnnouncementSendById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementSendById, GetAnnouncementSendByIdVariables } from '@dataconnect/generated';

// The `GetAnnouncementSendById` query requires an argument of type `GetAnnouncementSendByIdVariables`:
const getAnnouncementSendByIdVars: GetAnnouncementSendByIdVariables = {
  id: ..., 
};

// Call the `getAnnouncementSendById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAnnouncementSendById(getAnnouncementSendByIdVars);
// Variables can be defined inline as well.
const { data } = await getAnnouncementSendById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAnnouncementSendById(dataConnect, getAnnouncementSendByIdVars);

console.log(data.announcementSend);

// Or, you can use the `Promise` API.
getAnnouncementSendById(getAnnouncementSendByIdVars).then((response) => {
  const data = response.data;
  console.log(data.announcementSend);
});
```

### Using `GetAnnouncementSendById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAnnouncementSendByIdRef, GetAnnouncementSendByIdVariables } from '@dataconnect/generated';

// The `GetAnnouncementSendById` query requires an argument of type `GetAnnouncementSendByIdVariables`:
const getAnnouncementSendByIdVars: GetAnnouncementSendByIdVariables = {
  id: ..., 
};

// Call the `getAnnouncementSendByIdRef()` function to get a reference to the query.
const ref = getAnnouncementSendByIdRef(getAnnouncementSendByIdVars);
// Variables can be defined inline as well.
const ref = getAnnouncementSendByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAnnouncementSendByIdRef(dataConnect, getAnnouncementSendByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.announcementSend);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.announcementSend);
});
```

## GetUserByEmail
You can execute the `GetUserByEmail` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserByEmail(vars: GetUserByEmailVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByEmailData, GetUserByEmailVariables>;

interface GetUserByEmailRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByEmailVariables): QueryRef<GetUserByEmailData, GetUserByEmailVariables>;
}
export const getUserByEmailRef: GetUserByEmailRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserByEmail(dc: DataConnect, vars: GetUserByEmailVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByEmailData, GetUserByEmailVariables>;

interface GetUserByEmailRef {
  ...
  (dc: DataConnect, vars: GetUserByEmailVariables): QueryRef<GetUserByEmailData, GetUserByEmailVariables>;
}
export const getUserByEmailRef: GetUserByEmailRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByEmailRef:
```typescript
const name = getUserByEmailRef.operationName;
console.log(name);
```

### Variables
The `GetUserByEmail` query requires an argument of type `GetUserByEmailVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByEmailVariables {
  email: string;
}
```
### Return Type
Recall that executing the `GetUserByEmail` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByEmailData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserByEmailData {
  users: ({
    id: string;
    membershipStatus: MembershipStatus;
    emailBounceCount: number;
  } & User_Key)[];
}
```
### Using `GetUserByEmail`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserByEmail, GetUserByEmailVariables } from '@dataconnect/generated';

// The `GetUserByEmail` query requires an argument of type `GetUserByEmailVariables`:
const getUserByEmailVars: GetUserByEmailVariables = {
  email: ..., 
};

// Call the `getUserByEmail()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserByEmail(getUserByEmailVars);
// Variables can be defined inline as well.
const { data } = await getUserByEmail({ email: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserByEmail(dataConnect, getUserByEmailVars);

console.log(data.users);

// Or, you can use the `Promise` API.
getUserByEmail(getUserByEmailVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `GetUserByEmail`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByEmailRef, GetUserByEmailVariables } from '@dataconnect/generated';

// The `GetUserByEmail` query requires an argument of type `GetUserByEmailVariables`:
const getUserByEmailVars: GetUserByEmailVariables = {
  email: ..., 
};

// Call the `getUserByEmailRef()` function to get a reference to the query.
const ref = getUserByEmailRef(getUserByEmailVars);
// Variables can be defined inline as well.
const ref = getUserByEmailRef({ email: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByEmailRef(dataConnect, getUserByEmailVars);

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

## GetCallableInvocation
You can execute the `GetCallableInvocation` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getCallableInvocation(vars: GetCallableInvocationVariables, options?: ExecuteQueryOptions): QueryPromise<GetCallableInvocationData, GetCallableInvocationVariables>;

interface GetCallableInvocationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCallableInvocationVariables): QueryRef<GetCallableInvocationData, GetCallableInvocationVariables>;
}
export const getCallableInvocationRef: GetCallableInvocationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getCallableInvocation(dc: DataConnect, vars: GetCallableInvocationVariables, options?: ExecuteQueryOptions): QueryPromise<GetCallableInvocationData, GetCallableInvocationVariables>;

interface GetCallableInvocationRef {
  ...
  (dc: DataConnect, vars: GetCallableInvocationVariables): QueryRef<GetCallableInvocationData, GetCallableInvocationVariables>;
}
export const getCallableInvocationRef: GetCallableInvocationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getCallableInvocationRef:
```typescript
const name = getCallableInvocationRef.operationName;
console.log(name);
```

### Variables
The `GetCallableInvocation` query requires an argument of type `GetCallableInvocationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetCallableInvocationVariables {
  userId: string;
  functionName: string;
}
```
### Return Type
Recall that executing the `GetCallableInvocation` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetCallableInvocationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetCallableInvocationData {
  callableInvocation?: {
    windowStart: TimestampString;
    count: number;
  };
}
```
### Using `GetCallableInvocation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getCallableInvocation, GetCallableInvocationVariables } from '@dataconnect/generated';

// The `GetCallableInvocation` query requires an argument of type `GetCallableInvocationVariables`:
const getCallableInvocationVars: GetCallableInvocationVariables = {
  userId: ..., 
  functionName: ..., 
};

// Call the `getCallableInvocation()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getCallableInvocation(getCallableInvocationVars);
// Variables can be defined inline as well.
const { data } = await getCallableInvocation({ userId: ..., functionName: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getCallableInvocation(dataConnect, getCallableInvocationVars);

console.log(data.callableInvocation);

// Or, you can use the `Promise` API.
getCallableInvocation(getCallableInvocationVars).then((response) => {
  const data = response.data;
  console.log(data.callableInvocation);
});
```

### Using `GetCallableInvocation`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getCallableInvocationRef, GetCallableInvocationVariables } from '@dataconnect/generated';

// The `GetCallableInvocation` query requires an argument of type `GetCallableInvocationVariables`:
const getCallableInvocationVars: GetCallableInvocationVariables = {
  userId: ..., 
  functionName: ..., 
};

// Call the `getCallableInvocationRef()` function to get a reference to the query.
const ref = getCallableInvocationRef(getCallableInvocationVars);
// Variables can be defined inline as well.
const ref = getCallableInvocationRef({ userId: ..., functionName: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getCallableInvocationRef(dataConnect, getCallableInvocationVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.callableInvocation);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.callableInvocation);
});
```

## GetCurrentUser
You can execute the `GetCurrentUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getCurrentUser(options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

interface GetCurrentUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
}
export const getCurrentUserRef: GetCurrentUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getCurrentUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

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
getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

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
listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

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
listSections(options?: ExecuteQueryOptions): QueryPromise<ListSectionsData, undefined>;

interface ListSectionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSectionsData, undefined>;
}
export const listSectionsRef: ListSectionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSections(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListSectionsData, undefined>;

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
getSectionsForUser(options?: ExecuteQueryOptions): QueryPromise<GetSectionsForUserData, undefined>;

interface GetSectionsForUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSectionsForUserData, undefined>;
}
export const getSectionsForUserRef: GetSectionsForUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionsForUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetSectionsForUserData, undefined>;

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
          purposes?: SectionUserGroupPurpose[] | null;
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
      purposes?: SectionUserGroupPurpose[] | null;
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
listUserGroups(options?: ExecuteQueryOptions): QueryPromise<ListUserGroupsData, undefined>;

interface ListUserGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUserGroupsData, undefined>;
}
export const listUserGroupsRef: ListUserGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUserGroups(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUserGroupsData, undefined>;

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
getUserAccessGroups(options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsData, undefined>;

interface GetUserAccessGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserAccessGroupsData, undefined>;
}
export const getUserAccessGroupsRef: GetUserAccessGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserAccessGroups(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsData, undefined>;

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
checkUserProfileExists(options?: ExecuteQueryOptions): QueryPromise<CheckUserProfileExistsData, undefined>;

interface CheckUserProfileExistsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<CheckUserProfileExistsData, undefined>;
}
export const checkUserProfileExistsRef: CheckUserProfileExistsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
checkUserProfileExists(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<CheckUserProfileExistsData, undefined>;

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
getUserMembershipStatus(vars: GetUserMembershipStatusVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

interface GetUserMembershipStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserMembershipStatusVariables): QueryRef<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;
}
export const getUserMembershipStatusRef: GetUserMembershipStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserMembershipStatus(dc: DataConnect, vars: GetUserMembershipStatusVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserMembershipStatusData, GetUserMembershipStatusVariables>;

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
    firstName: string;
    lastName: string;
    email: string;
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
getUserWithAccessGroups(vars: GetUserWithAccessGroupsVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;

interface GetUserWithAccessGroupsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserWithAccessGroupsVariables): QueryRef<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;
}
export const getUserWithAccessGroupsRef: GetUserWithAccessGroupsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserWithAccessGroups(dc: DataConnect, vars: GetUserWithAccessGroupsVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserWithAccessGroupsData, GetUserWithAccessGroupsVariables>;

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
getUserAccessGroupsById(vars: GetUserAccessGroupsByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;

interface GetUserAccessGroupsByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserAccessGroupsByIdVariables): QueryRef<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;
}
export const getUserAccessGroupsByIdRef: GetUserAccessGroupsByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserAccessGroupsById(dc: DataConnect, vars: GetUserAccessGroupsByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserAccessGroupsByIdData, GetUserAccessGroupsByIdVariables>;

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
getEventsForSection(vars: GetEventsForSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;

interface GetEventsForSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventsForSectionVariables): QueryRef<GetEventsForSectionData, GetEventsForSectionVariables>;
}
export const getEventsForSectionRef: GetEventsForSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEventsForSection(dc: DataConnect, vars: GetEventsForSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventsForSectionData, GetEventsForSectionVariables>;

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
      maxGuestsWithoutModeratorApproval?: number | null;
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
getEventById(vars: GetEventByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdData, GetEventByIdVariables>;

interface GetEventByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetEventByIdVariables): QueryRef<GetEventByIdData, GetEventByIdVariables>;
}
export const getEventByIdRef: GetEventByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getEventById(dc: DataConnect, vars: GetEventByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetEventByIdData, GetEventByIdVariables>;

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
    maxGuestsWithoutModeratorApproval?: number | null;
    ticketTypes: ({
      id: UUIDString;
      title: string;
      description?: string | null;
      audience: TicketAudience;
      price: number;
      sortOrder: number;
      userGroup: {
        id: UUIDString;
        name: string;
        membershipStatuses?: MembershipStatus[] | null;
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
getSectionById(vars: GetSectionByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;

interface GetSectionByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionByIdVariables): QueryRef<GetSectionByIdData, GetSectionByIdVariables>;
}
export const getSectionByIdRef: GetSectionByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionById(dc: DataConnect, vars: GetSectionByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionByIdData, GetSectionByIdVariables>;

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
      purposes?: SectionUserGroupPurpose[] | null;
      userGroup: {
        id: UUIDString;
        name: string;
        description?: string | null;
        subscribable?: boolean | null;
        membershipStatuses?: MembershipStatus[] | null;
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
getUserGroupById(vars: GetUserGroupByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;

interface GetUserGroupByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserGroupByIdVariables): QueryRef<GetUserGroupByIdData, GetUserGroupByIdVariables>;
}
export const getUserGroupByIdRef: GetUserGroupByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserGroupById(dc: DataConnect, vars: GetUserGroupByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserGroupByIdData, GetUserGroupByIdVariables>;

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
      purposes?: SectionUserGroupPurpose[] | null;
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
getAllUserGroupsWithStatuses(options?: ExecuteQueryOptions): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;

interface GetAllUserGroupsWithStatusesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllUserGroupsWithStatusesData, undefined>;
}
export const getAllUserGroupsWithStatusesRef: GetAllUserGroupsWithStatusesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAllUserGroupsWithStatuses(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetAllUserGroupsWithStatusesData, undefined>;

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
getSectionMembers(vars: GetSectionMembersVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;

interface GetSectionMembersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionMembersVariables): QueryRef<GetSectionMembersData, GetSectionMembersVariables>;
}
export const getSectionMembersRef: GetSectionMembersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionMembers(dc: DataConnect, vars: GetSectionMembersVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionMembersData, GetSectionMembersVariables>;

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
      purposes?: SectionUserGroupPurpose[] | null;
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
            serviceNumber: string;
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

## GetMyBookingsForEvent
You can execute the `GetMyBookingsForEvent` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyBookingsForEvent(vars: GetMyBookingsForEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;

interface GetMyBookingsForEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyBookingsForEventVariables): QueryRef<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
}
export const getMyBookingsForEventRef: GetMyBookingsForEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyBookingsForEvent(dc: DataConnect, vars: GetMyBookingsForEventVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;

interface GetMyBookingsForEventRef {
  ...
  (dc: DataConnect, vars: GetMyBookingsForEventVariables): QueryRef<GetMyBookingsForEventData, GetMyBookingsForEventVariables>;
}
export const getMyBookingsForEventRef: GetMyBookingsForEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyBookingsForEventRef:
```typescript
const name = getMyBookingsForEventRef.operationName;
console.log(name);
```

### Variables
The `GetMyBookingsForEvent` query requires an argument of type `GetMyBookingsForEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetMyBookingsForEventVariables {
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `GetMyBookingsForEvent` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyBookingsForEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyBookingsForEventData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionNumber: number;
      supersededAt?: TimestampString | null;
      clientSubmissionKey?: string | null;
      bookerDietaryNote?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      lines: ({
        id: UUIDString;
        sortOrder: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
        guestUser?: {
          id: string;
          firstName: string;
          lastName: string;
        } & User_Key;
      } & BookingLine_Key)[];
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
        reviewedAt?: TimestampString | null;
        moderatorNote?: string | null;
      } & GuestTicketRequest_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}
```
### Using `GetMyBookingsForEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyBookingsForEvent, GetMyBookingsForEventVariables } from '@dataconnect/generated';

// The `GetMyBookingsForEvent` query requires an argument of type `GetMyBookingsForEventVariables`:
const getMyBookingsForEventVars: GetMyBookingsForEventVariables = {
  eventId: ..., 
};

// Call the `getMyBookingsForEvent()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyBookingsForEvent(getMyBookingsForEventVars);
// Variables can be defined inline as well.
const { data } = await getMyBookingsForEvent({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyBookingsForEvent(dataConnect, getMyBookingsForEventVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getMyBookingsForEvent(getMyBookingsForEventVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetMyBookingsForEvent`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyBookingsForEventRef, GetMyBookingsForEventVariables } from '@dataconnect/generated';

// The `GetMyBookingsForEvent` query requires an argument of type `GetMyBookingsForEventVariables`:
const getMyBookingsForEventVars: GetMyBookingsForEventVariables = {
  eventId: ..., 
};

// Call the `getMyBookingsForEventRef()` function to get a reference to the query.
const ref = getMyBookingsForEventRef(getMyBookingsForEventVars);
// Variables can be defined inline as well.
const ref = getMyBookingsForEventRef({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyBookingsForEventRef(dataConnect, getMyBookingsForEventVars);

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

## GetMyBookings
You can execute the `GetMyBookings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyBookings(options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsData, undefined>;

interface GetMyBookingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyBookingsData, undefined>;
}
export const getMyBookingsRef: GetMyBookingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyBookings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingsData, undefined>;

interface GetMyBookingsRef {
  ...
  (dc: DataConnect): QueryRef<GetMyBookingsData, undefined>;
}
export const getMyBookingsRef: GetMyBookingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyBookingsRef:
```typescript
const name = getMyBookingsRef.operationName;
console.log(name);
```

### Variables
The `GetMyBookings` query has no variables.
### Return Type
Recall that executing the `GetMyBookings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyBookingsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyBookingsData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionNumber: number;
      updatedAt: TimestampString;
      event: {
        id: UUIDString;
        title: string;
        startDateTime: TimestampString;
        endDateTime: TimestampString;
        section: {
          id: UUIDString;
          name: string;
        } & Section_Key;
      } & Event_Key;
      lines: ({
        id: UUIDString;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
      } & BookingLine_Key)[];
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          price: number;
        } & TicketType_Key;
      } & GuestTicketRequest_Key)[];
    } & Booking_Key)[];
  } & User_Key;
}
```
### Using `GetMyBookings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyBookings } from '@dataconnect/generated';


// Call the `getMyBookings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyBookings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyBookings(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getMyBookings().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetMyBookings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyBookingsRef } from '@dataconnect/generated';


// Call the `getMyBookingsRef()` function to get a reference to the query.
const ref = getMyBookingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyBookingsRef(dataConnect);

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

## GetMyTicketOrderById
You can execute the `GetMyTicketOrderById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyTicketOrderById(vars: GetMyTicketOrderByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;

interface GetMyTicketOrderByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyTicketOrderByIdVariables): QueryRef<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
}
export const getMyTicketOrderByIdRef: GetMyTicketOrderByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyTicketOrderById(dc: DataConnect, vars: GetMyTicketOrderByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;

interface GetMyTicketOrderByIdRef {
  ...
  (dc: DataConnect, vars: GetMyTicketOrderByIdVariables): QueryRef<GetMyTicketOrderByIdData, GetMyTicketOrderByIdVariables>;
}
export const getMyTicketOrderByIdRef: GetMyTicketOrderByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyTicketOrderByIdRef:
```typescript
const name = getMyTicketOrderByIdRef.operationName;
console.log(name);
```

### Variables
The `GetMyTicketOrderById` query requires an argument of type `GetMyTicketOrderByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetMyTicketOrderByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetMyTicketOrderById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyTicketOrderByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyTicketOrderByIdData {
  user?: {
    id: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      totalAmountMinor: number;
      currency: string;
      updatedAt: TimestampString;
      ticketType: {
        id: UUIDString;
        title: string;
      } & TicketType_Key;
      event: {
        id: UUIDString;
        title: string;
      } & Event_Key;
    } & TicketOrder_Key)[];
  } & User_Key;
}
```
### Using `GetMyTicketOrderById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyTicketOrderById, GetMyTicketOrderByIdVariables } from '@dataconnect/generated';

// The `GetMyTicketOrderById` query requires an argument of type `GetMyTicketOrderByIdVariables`:
const getMyTicketOrderByIdVars: GetMyTicketOrderByIdVariables = {
  id: ..., 
};

// Call the `getMyTicketOrderById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyTicketOrderById(getMyTicketOrderByIdVars);
// Variables can be defined inline as well.
const { data } = await getMyTicketOrderById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyTicketOrderById(dataConnect, getMyTicketOrderByIdVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getMyTicketOrderById(getMyTicketOrderByIdVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetMyTicketOrderById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyTicketOrderByIdRef, GetMyTicketOrderByIdVariables } from '@dataconnect/generated';

// The `GetMyTicketOrderById` query requires an argument of type `GetMyTicketOrderByIdVariables`:
const getMyTicketOrderByIdVars: GetMyTicketOrderByIdVariables = {
  id: ..., 
};

// Call the `getMyTicketOrderByIdRef()` function to get a reference to the query.
const ref = getMyTicketOrderByIdRef(getMyTicketOrderByIdVars);
// Variables can be defined inline as well.
const ref = getMyTicketOrderByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyTicketOrderByIdRef(dataConnect, getMyTicketOrderByIdVars);

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

## GetMyTicketOrders
You can execute the `GetMyTicketOrders` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyTicketOrders(options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrdersData, undefined>;

interface GetMyTicketOrdersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyTicketOrdersData, undefined>;
}
export const getMyTicketOrdersRef: GetMyTicketOrdersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyTicketOrders(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketOrdersData, undefined>;

interface GetMyTicketOrdersRef {
  ...
  (dc: DataConnect): QueryRef<GetMyTicketOrdersData, undefined>;
}
export const getMyTicketOrdersRef: GetMyTicketOrdersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyTicketOrdersRef:
```typescript
const name = getMyTicketOrdersRef.operationName;
console.log(name);
```

### Variables
The `GetMyTicketOrders` query has no variables.
### Return Type
Recall that executing the `GetMyTicketOrders` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyTicketOrdersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyTicketOrdersData {
  user?: {
    id: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      totalAmountMinor: number;
      currency: string;
      refundedAmountMinor?: number | null;
      refundedAt?: TimestampString | null;
      disputeStatus?: string | null;
      disputeReason?: string | null;
      stripeCheckoutSessionId?: string | null;
      stripePaymentIntentId?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      ticketType: {
        id: UUIDString;
        title: string;
      } & TicketType_Key;
      event: {
        id: UUIDString;
        title: string;
        startDateTime: TimestampString;
      } & Event_Key;
    } & TicketOrder_Key)[];
  } & User_Key;
}
```
### Using `GetMyTicketOrders`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyTicketOrders } from '@dataconnect/generated';


// Call the `getMyTicketOrders()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyTicketOrders();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyTicketOrders(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getMyTicketOrders().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetMyTicketOrders`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyTicketOrdersRef } from '@dataconnect/generated';


// Call the `getMyTicketOrdersRef()` function to get a reference to the query.
const ref = getMyTicketOrdersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyTicketOrdersRef(dataConnect);

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

## GetMyBookingPaymentAdjustments
You can execute the `GetMyBookingPaymentAdjustments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyBookingPaymentAdjustments(options?: ExecuteQueryOptions): QueryPromise<GetMyBookingPaymentAdjustmentsData, undefined>;

interface GetMyBookingPaymentAdjustmentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyBookingPaymentAdjustmentsData, undefined>;
}
export const getMyBookingPaymentAdjustmentsRef: GetMyBookingPaymentAdjustmentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyBookingPaymentAdjustments(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyBookingPaymentAdjustmentsData, undefined>;

interface GetMyBookingPaymentAdjustmentsRef {
  ...
  (dc: DataConnect): QueryRef<GetMyBookingPaymentAdjustmentsData, undefined>;
}
export const getMyBookingPaymentAdjustmentsRef: GetMyBookingPaymentAdjustmentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyBookingPaymentAdjustmentsRef:
```typescript
const name = getMyBookingPaymentAdjustmentsRef.operationName;
console.log(name);
```

### Variables
The `GetMyBookingPaymentAdjustments` query has no variables.
### Return Type
Recall that executing the `GetMyBookingPaymentAdjustments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyBookingPaymentAdjustmentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyBookingPaymentAdjustmentsData {
  user?: {
    id: string;
    bookings: ({
      id: UUIDString;
      revisionNumber: number;
      event: {
        id: UUIDString;
        title: string;
      } & Event_Key;
      adjustments: ({
        id: UUIDString;
        deltaAmountMinor: number;
        status: BookingPaymentAdjustmentStatus;
        orchestrationKey: string;
        createdAt: TimestampString;
        updatedAt: TimestampString;
        supersededBooking: {
          id: UUIDString;
          revisionNumber: number;
        } & Booking_Key;
      })[];
    } & Booking_Key)[];
  } & User_Key;
}
```
### Using `GetMyBookingPaymentAdjustments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyBookingPaymentAdjustments } from '@dataconnect/generated';


// Call the `getMyBookingPaymentAdjustments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyBookingPaymentAdjustments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyBookingPaymentAdjustments(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getMyBookingPaymentAdjustments().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetMyBookingPaymentAdjustments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyBookingPaymentAdjustmentsRef } from '@dataconnect/generated';


// Call the `getMyBookingPaymentAdjustmentsRef()` function to get a reference to the query.
const ref = getMyBookingPaymentAdjustmentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyBookingPaymentAdjustmentsRef(dataConnect);

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

## ListEventBookingsForAdmin
You can execute the `ListEventBookingsForAdmin` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listEventBookingsForAdmin(vars: ListEventBookingsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;

interface ListEventBookingsForAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListEventBookingsForAdminVariables): QueryRef<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
}
export const listEventBookingsForAdminRef: ListEventBookingsForAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listEventBookingsForAdmin(dc: DataConnect, vars: ListEventBookingsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;

interface ListEventBookingsForAdminRef {
  ...
  (dc: DataConnect, vars: ListEventBookingsForAdminVariables): QueryRef<ListEventBookingsForAdminData, ListEventBookingsForAdminVariables>;
}
export const listEventBookingsForAdminRef: ListEventBookingsForAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listEventBookingsForAdminRef:
```typescript
const name = listEventBookingsForAdminRef.operationName;
console.log(name);
```

### Variables
The `ListEventBookingsForAdmin` query requires an argument of type `ListEventBookingsForAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListEventBookingsForAdminVariables {
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `ListEventBookingsForAdmin` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListEventBookingsForAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListEventBookingsForAdminData {
  event?: {
    id: UUIDString;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionNumber: number;
      supersedesBooking?: {
        id: UUIDString;
        revisionNumber: number;
      } & Booking_Key;
      clientSubmissionKey?: string | null;
      bookerDietaryNote?: string | null;
      sitNextToUserIds?: string[] | null;
      accommodationRequested: boolean;
      accommodationNote?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      createdBy?: string | null;
      updatedBy?: string | null;
      booker: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        reviewedAt?: TimestampString | null;
        moderatorNote?: string | null;
        createdAt: TimestampString;
        updatedAt: TimestampString;
        createdBy?: string | null;
        updatedBy?: string | null;
        reviewedBy?: {
          id: string;
          firstName: string;
          lastName: string;
        } & User_Key;
      } & GuestTicketRequest_Key)[];
      lines: ({
        id: UUIDString;
        ticketType: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
        } & TicketType_Key;
      } & BookingLine_Key)[];
    } & Booking_Key)[];
  } & Event_Key;
}
```
### Using `ListEventBookingsForAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listEventBookingsForAdmin, ListEventBookingsForAdminVariables } from '@dataconnect/generated';

// The `ListEventBookingsForAdmin` query requires an argument of type `ListEventBookingsForAdminVariables`:
const listEventBookingsForAdminVars: ListEventBookingsForAdminVariables = {
  eventId: ..., 
};

// Call the `listEventBookingsForAdmin()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listEventBookingsForAdmin(listEventBookingsForAdminVars);
// Variables can be defined inline as well.
const { data } = await listEventBookingsForAdmin({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listEventBookingsForAdmin(dataConnect, listEventBookingsForAdminVars);

console.log(data.event);

// Or, you can use the `Promise` API.
listEventBookingsForAdmin(listEventBookingsForAdminVars).then((response) => {
  const data = response.data;
  console.log(data.event);
});
```

### Using `ListEventBookingsForAdmin`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listEventBookingsForAdminRef, ListEventBookingsForAdminVariables } from '@dataconnect/generated';

// The `ListEventBookingsForAdmin` query requires an argument of type `ListEventBookingsForAdminVariables`:
const listEventBookingsForAdminVars: ListEventBookingsForAdminVariables = {
  eventId: ..., 
};

// Call the `listEventBookingsForAdminRef()` function to get a reference to the query.
const ref = listEventBookingsForAdminRef(listEventBookingsForAdminVars);
// Variables can be defined inline as well.
const ref = listEventBookingsForAdminRef({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listEventBookingsForAdminRef(dataConnect, listEventBookingsForAdminVars);

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

## ListGuestTicketRequestsForAdmin
You can execute the `ListGuestTicketRequestsForAdmin` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listGuestTicketRequestsForAdmin(vars: ListGuestTicketRequestsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;

interface ListGuestTicketRequestsForAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListGuestTicketRequestsForAdminVariables): QueryRef<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
}
export const listGuestTicketRequestsForAdminRef: ListGuestTicketRequestsForAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listGuestTicketRequestsForAdmin(dc: DataConnect, vars: ListGuestTicketRequestsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;

interface ListGuestTicketRequestsForAdminRef {
  ...
  (dc: DataConnect, vars: ListGuestTicketRequestsForAdminVariables): QueryRef<ListGuestTicketRequestsForAdminData, ListGuestTicketRequestsForAdminVariables>;
}
export const listGuestTicketRequestsForAdminRef: ListGuestTicketRequestsForAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listGuestTicketRequestsForAdminRef:
```typescript
const name = listGuestTicketRequestsForAdminRef.operationName;
console.log(name);
```

### Variables
The `ListGuestTicketRequestsForAdmin` query requires an argument of type `ListGuestTicketRequestsForAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListGuestTicketRequestsForAdminVariables {
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `ListGuestTicketRequestsForAdmin` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListGuestTicketRequestsForAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListGuestTicketRequestsForAdminData {
  event?: {
    id: UUIDString;
    title: string;
    bookings: ({
      id: UUIDString;
      status: BookingStatus;
      revisionNumber: number;
      revisionGroupId: UUIDString;
      supersededAt?: TimestampString | null;
      supersedesBooking?: {
        id: UUIDString;
        revisionNumber: number;
      } & Booking_Key;
      booker: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      guestTicketRequests: ({
        id: UUIDString;
        status: GuestTicketRequestStatus;
        requestedGuestCount: number;
        guestDisplayName?: string | null;
        dietaryNote?: string | null;
        moderatorNote?: string | null;
        createdAt: TimestampString;
        reviewedAt?: TimestampString | null;
        createdBy?: string | null;
        updatedAt: TimestampString;
        updatedBy?: string | null;
        reviewedBy?: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
        } & User_Key;
        guestTicketType?: {
          id: UUIDString;
          title: string;
          audience: TicketAudience;
          price: number;
        } & TicketType_Key;
      } & GuestTicketRequest_Key)[];
    } & Booking_Key)[];
  } & Event_Key;
}
```
### Using `ListGuestTicketRequestsForAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listGuestTicketRequestsForAdmin, ListGuestTicketRequestsForAdminVariables } from '@dataconnect/generated';

// The `ListGuestTicketRequestsForAdmin` query requires an argument of type `ListGuestTicketRequestsForAdminVariables`:
const listGuestTicketRequestsForAdminVars: ListGuestTicketRequestsForAdminVariables = {
  eventId: ..., 
};

// Call the `listGuestTicketRequestsForAdmin()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listGuestTicketRequestsForAdmin(listGuestTicketRequestsForAdminVars);
// Variables can be defined inline as well.
const { data } = await listGuestTicketRequestsForAdmin({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listGuestTicketRequestsForAdmin(dataConnect, listGuestTicketRequestsForAdminVars);

console.log(data.event);

// Or, you can use the `Promise` API.
listGuestTicketRequestsForAdmin(listGuestTicketRequestsForAdminVars).then((response) => {
  const data = response.data;
  console.log(data.event);
});
```

### Using `ListGuestTicketRequestsForAdmin`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listGuestTicketRequestsForAdminRef, ListGuestTicketRequestsForAdminVariables } from '@dataconnect/generated';

// The `ListGuestTicketRequestsForAdmin` query requires an argument of type `ListGuestTicketRequestsForAdminVariables`:
const listGuestTicketRequestsForAdminVars: ListGuestTicketRequestsForAdminVariables = {
  eventId: ..., 
};

// Call the `listGuestTicketRequestsForAdminRef()` function to get a reference to the query.
const ref = listGuestTicketRequestsForAdminRef(listGuestTicketRequestsForAdminVars);
// Variables can be defined inline as well.
const ref = listGuestTicketRequestsForAdminRef({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listGuestTicketRequestsForAdminRef(dataConnect, listGuestTicketRequestsForAdminVars);

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

## ListTicketOrdersForAdmin
You can execute the `ListTicketOrdersForAdmin` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listTicketOrdersForAdmin(vars: ListTicketOrdersForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;

interface ListTicketOrdersForAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListTicketOrdersForAdminVariables): QueryRef<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
}
export const listTicketOrdersForAdminRef: ListTicketOrdersForAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listTicketOrdersForAdmin(dc: DataConnect, vars: ListTicketOrdersForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;

interface ListTicketOrdersForAdminRef {
  ...
  (dc: DataConnect, vars: ListTicketOrdersForAdminVariables): QueryRef<ListTicketOrdersForAdminData, ListTicketOrdersForAdminVariables>;
}
export const listTicketOrdersForAdminRef: ListTicketOrdersForAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listTicketOrdersForAdminRef:
```typescript
const name = listTicketOrdersForAdminRef.operationName;
console.log(name);
```

### Variables
The `ListTicketOrdersForAdmin` query requires an argument of type `ListTicketOrdersForAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListTicketOrdersForAdminVariables {
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `ListTicketOrdersForAdmin` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListTicketOrdersForAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListTicketOrdersForAdminData {
  event?: {
    id: UUIDString;
    title: string;
    ticketOrders: ({
      id: UUIDString;
      status: TicketOrderStatus;
      quantity: number;
      totalAmountMinor: number;
      currency: string;
      stripeCheckoutSessionId?: string | null;
      stripePaymentIntentId?: string | null;
      stripeRefundId?: string | null;
      refundedAmountMinor?: number | null;
      refundedAt?: TimestampString | null;
      stripeDisputeId?: string | null;
      disputeStatus?: string | null;
      disputeReason?: string | null;
      disputeAmountMinor?: number | null;
      disputeOpenedAt?: TimestampString | null;
      disputeUpdatedAt?: TimestampString | null;
      disputeClosedAt?: TimestampString | null;
      webhookEventId?: string | null;
      createdAt: TimestampString;
      updatedAt: TimestampString;
      createdBy?: string | null;
      updatedBy?: string | null;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      ticketType: {
        id: UUIDString;
        title: string;
      } & TicketType_Key;
    } & TicketOrder_Key)[];
  } & Event_Key;
}
```
### Using `ListTicketOrdersForAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listTicketOrdersForAdmin, ListTicketOrdersForAdminVariables } from '@dataconnect/generated';

// The `ListTicketOrdersForAdmin` query requires an argument of type `ListTicketOrdersForAdminVariables`:
const listTicketOrdersForAdminVars: ListTicketOrdersForAdminVariables = {
  eventId: ..., 
};

// Call the `listTicketOrdersForAdmin()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listTicketOrdersForAdmin(listTicketOrdersForAdminVars);
// Variables can be defined inline as well.
const { data } = await listTicketOrdersForAdmin({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listTicketOrdersForAdmin(dataConnect, listTicketOrdersForAdminVars);

console.log(data.event);

// Or, you can use the `Promise` API.
listTicketOrdersForAdmin(listTicketOrdersForAdminVars).then((response) => {
  const data = response.data;
  console.log(data.event);
});
```

### Using `ListTicketOrdersForAdmin`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listTicketOrdersForAdminRef, ListTicketOrdersForAdminVariables } from '@dataconnect/generated';

// The `ListTicketOrdersForAdmin` query requires an argument of type `ListTicketOrdersForAdminVariables`:
const listTicketOrdersForAdminVars: ListTicketOrdersForAdminVariables = {
  eventId: ..., 
};

// Call the `listTicketOrdersForAdminRef()` function to get a reference to the query.
const ref = listTicketOrdersForAdminRef(listTicketOrdersForAdminVars);
// Variables can be defined inline as well.
const ref = listTicketOrdersForAdminRef({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listTicketOrdersForAdminRef(dataConnect, listTicketOrdersForAdminVars);

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

## ListBookingPaymentAdjustmentsForAdmin
You can execute the `ListBookingPaymentAdjustmentsForAdmin` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listBookingPaymentAdjustmentsForAdmin(vars: ListBookingPaymentAdjustmentsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;

interface ListBookingPaymentAdjustmentsForAdminRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListBookingPaymentAdjustmentsForAdminVariables): QueryRef<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;
}
export const listBookingPaymentAdjustmentsForAdminRef: ListBookingPaymentAdjustmentsForAdminRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listBookingPaymentAdjustmentsForAdmin(dc: DataConnect, vars: ListBookingPaymentAdjustmentsForAdminVariables, options?: ExecuteQueryOptions): QueryPromise<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;

interface ListBookingPaymentAdjustmentsForAdminRef {
  ...
  (dc: DataConnect, vars: ListBookingPaymentAdjustmentsForAdminVariables): QueryRef<ListBookingPaymentAdjustmentsForAdminData, ListBookingPaymentAdjustmentsForAdminVariables>;
}
export const listBookingPaymentAdjustmentsForAdminRef: ListBookingPaymentAdjustmentsForAdminRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listBookingPaymentAdjustmentsForAdminRef:
```typescript
const name = listBookingPaymentAdjustmentsForAdminRef.operationName;
console.log(name);
```

### Variables
The `ListBookingPaymentAdjustmentsForAdmin` query requires an argument of type `ListBookingPaymentAdjustmentsForAdminVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListBookingPaymentAdjustmentsForAdminVariables {
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `ListBookingPaymentAdjustmentsForAdmin` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListBookingPaymentAdjustmentsForAdminData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListBookingPaymentAdjustmentsForAdminData {
  event?: {
    id: UUIDString;
    bookings: ({
      id: UUIDString;
      revisionNumber: number;
      status: BookingStatus;
      booker: {
        id: string;
        firstName: string;
        lastName: string;
      } & User_Key;
      adjustments: ({
        id: UUIDString;
        deltaAmountMinor: number;
        status: BookingPaymentAdjustmentStatus;
        orchestrationKey: string;
        createdAt: TimestampString;
        updatedAt: TimestampString;
        supersededBooking: {
          id: UUIDString;
          revisionNumber: number;
        } & Booking_Key;
      })[];
    } & Booking_Key)[];
  } & Event_Key;
}
```
### Using `ListBookingPaymentAdjustmentsForAdmin`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listBookingPaymentAdjustmentsForAdmin, ListBookingPaymentAdjustmentsForAdminVariables } from '@dataconnect/generated';

// The `ListBookingPaymentAdjustmentsForAdmin` query requires an argument of type `ListBookingPaymentAdjustmentsForAdminVariables`:
const listBookingPaymentAdjustmentsForAdminVars: ListBookingPaymentAdjustmentsForAdminVariables = {
  eventId: ..., 
};

// Call the `listBookingPaymentAdjustmentsForAdmin()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listBookingPaymentAdjustmentsForAdmin(listBookingPaymentAdjustmentsForAdminVars);
// Variables can be defined inline as well.
const { data } = await listBookingPaymentAdjustmentsForAdmin({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listBookingPaymentAdjustmentsForAdmin(dataConnect, listBookingPaymentAdjustmentsForAdminVars);

console.log(data.event);

// Or, you can use the `Promise` API.
listBookingPaymentAdjustmentsForAdmin(listBookingPaymentAdjustmentsForAdminVars).then((response) => {
  const data = response.data;
  console.log(data.event);
});
```

### Using `ListBookingPaymentAdjustmentsForAdmin`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listBookingPaymentAdjustmentsForAdminRef, ListBookingPaymentAdjustmentsForAdminVariables } from '@dataconnect/generated';

// The `ListBookingPaymentAdjustmentsForAdmin` query requires an argument of type `ListBookingPaymentAdjustmentsForAdminVariables`:
const listBookingPaymentAdjustmentsForAdminVars: ListBookingPaymentAdjustmentsForAdminVariables = {
  eventId: ..., 
};

// Call the `listBookingPaymentAdjustmentsForAdminRef()` function to get a reference to the query.
const ref = listBookingPaymentAdjustmentsForAdminRef(listBookingPaymentAdjustmentsForAdminVars);
// Variables can be defined inline as well.
const ref = listBookingPaymentAdjustmentsForAdminRef({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listBookingPaymentAdjustmentsForAdminRef(dataConnect, listBookingPaymentAdjustmentsForAdminVars);

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

## ListOpenPaymentReconciliationExceptions
You can execute the `ListOpenPaymentReconciliationExceptions` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listOpenPaymentReconciliationExceptions(options?: ExecuteQueryOptions): QueryPromise<ListOpenPaymentReconciliationExceptionsData, undefined>;

interface ListOpenPaymentReconciliationExceptionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListOpenPaymentReconciliationExceptionsData, undefined>;
}
export const listOpenPaymentReconciliationExceptionsRef: ListOpenPaymentReconciliationExceptionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listOpenPaymentReconciliationExceptions(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListOpenPaymentReconciliationExceptionsData, undefined>;

interface ListOpenPaymentReconciliationExceptionsRef {
  ...
  (dc: DataConnect): QueryRef<ListOpenPaymentReconciliationExceptionsData, undefined>;
}
export const listOpenPaymentReconciliationExceptionsRef: ListOpenPaymentReconciliationExceptionsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listOpenPaymentReconciliationExceptionsRef:
```typescript
const name = listOpenPaymentReconciliationExceptionsRef.operationName;
console.log(name);
```

### Variables
The `ListOpenPaymentReconciliationExceptions` query has no variables.
### Return Type
Recall that executing the `ListOpenPaymentReconciliationExceptions` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListOpenPaymentReconciliationExceptionsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListOpenPaymentReconciliationExceptionsData {
  paymentReconciliationExceptions: ({
    id: UUIDString;
    exceptionType: PaymentReconciliationExceptionType;
    status: PaymentReconciliationExceptionStatus;
    note?: string | null;
    ownerUserId?: string | null;
    lastAttemptedAt?: TimestampString | null;
    resolvedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    ticketOrder: {
      id: UUIDString;
      status: TicketOrderStatus;
      totalAmountMinor: number;
      currency: string;
      refundedAmountMinor?: number | null;
      disputeStatus?: string | null;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } & User_Key;
      event: {
        id: UUIDString;
        title: string;
      } & Event_Key;
    } & TicketOrder_Key;
  } & PaymentReconciliationException_Key)[];
}
```
### Using `ListOpenPaymentReconciliationExceptions`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listOpenPaymentReconciliationExceptions } from '@dataconnect/generated';


// Call the `listOpenPaymentReconciliationExceptions()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listOpenPaymentReconciliationExceptions();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listOpenPaymentReconciliationExceptions(dataConnect);

console.log(data.paymentReconciliationExceptions);

// Or, you can use the `Promise` API.
listOpenPaymentReconciliationExceptions().then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationExceptions);
});
```

### Using `ListOpenPaymentReconciliationExceptions`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listOpenPaymentReconciliationExceptionsRef } from '@dataconnect/generated';


// Call the `listOpenPaymentReconciliationExceptionsRef()` function to get a reference to the query.
const ref = listOpenPaymentReconciliationExceptionsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listOpenPaymentReconciliationExceptionsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.paymentReconciliationExceptions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationExceptions);
});
```

## GetSectionAnnouncementOptOut
You can execute the `GetSectionAnnouncementOptOut` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSectionAnnouncementOptOut(vars: GetSectionAnnouncementOptOutVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;

interface GetSectionAnnouncementOptOutRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSectionAnnouncementOptOutVariables): QueryRef<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;
}
export const getSectionAnnouncementOptOutRef: GetSectionAnnouncementOptOutRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSectionAnnouncementOptOut(dc: DataConnect, vars: GetSectionAnnouncementOptOutVariables, options?: ExecuteQueryOptions): QueryPromise<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;

interface GetSectionAnnouncementOptOutRef {
  ...
  (dc: DataConnect, vars: GetSectionAnnouncementOptOutVariables): QueryRef<GetSectionAnnouncementOptOutData, GetSectionAnnouncementOptOutVariables>;
}
export const getSectionAnnouncementOptOutRef: GetSectionAnnouncementOptOutRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSectionAnnouncementOptOutRef:
```typescript
const name = getSectionAnnouncementOptOutRef.operationName;
console.log(name);
```

### Variables
The `GetSectionAnnouncementOptOut` query requires an argument of type `GetSectionAnnouncementOptOutVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSectionAnnouncementOptOutVariables {
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `GetSectionAnnouncementOptOut` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSectionAnnouncementOptOutData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSectionAnnouncementOptOutData {
  sectionAnnouncementOptOut?: {
    createdAt: TimestampString;
  };
}
```
### Using `GetSectionAnnouncementOptOut`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSectionAnnouncementOptOut, GetSectionAnnouncementOptOutVariables } from '@dataconnect/generated';

// The `GetSectionAnnouncementOptOut` query requires an argument of type `GetSectionAnnouncementOptOutVariables`:
const getSectionAnnouncementOptOutVars: GetSectionAnnouncementOptOutVariables = {
  sectionId: ..., 
};

// Call the `getSectionAnnouncementOptOut()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSectionAnnouncementOptOut(getSectionAnnouncementOptOutVars);
// Variables can be defined inline as well.
const { data } = await getSectionAnnouncementOptOut({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSectionAnnouncementOptOut(dataConnect, getSectionAnnouncementOptOutVars);

console.log(data.sectionAnnouncementOptOut);

// Or, you can use the `Promise` API.
getSectionAnnouncementOptOut(getSectionAnnouncementOptOutVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut);
});
```

### Using `GetSectionAnnouncementOptOut`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSectionAnnouncementOptOutRef, GetSectionAnnouncementOptOutVariables } from '@dataconnect/generated';

// The `GetSectionAnnouncementOptOut` query requires an argument of type `GetSectionAnnouncementOptOutVariables`:
const getSectionAnnouncementOptOutVars: GetSectionAnnouncementOptOutVariables = {
  sectionId: ..., 
};

// Call the `getSectionAnnouncementOptOutRef()` function to get a reference to the query.
const ref = getSectionAnnouncementOptOutRef(getSectionAnnouncementOptOutVars);
// Variables can be defined inline as well.
const ref = getSectionAnnouncementOptOutRef({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSectionAnnouncementOptOutRef(dataConnect, getSectionAnnouncementOptOutVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sectionAnnouncementOptOut);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut);
});
```

## GetMyAnnouncementPreferences
You can execute the `GetMyAnnouncementPreferences` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyAnnouncementPreferences(options?: ExecuteQueryOptions): QueryPromise<GetMyAnnouncementPreferencesData, undefined>;

interface GetMyAnnouncementPreferencesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyAnnouncementPreferencesData, undefined>;
}
export const getMyAnnouncementPreferencesRef: GetMyAnnouncementPreferencesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyAnnouncementPreferences(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyAnnouncementPreferencesData, undefined>;

interface GetMyAnnouncementPreferencesRef {
  ...
  (dc: DataConnect): QueryRef<GetMyAnnouncementPreferencesData, undefined>;
}
export const getMyAnnouncementPreferencesRef: GetMyAnnouncementPreferencesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyAnnouncementPreferencesRef:
```typescript
const name = getMyAnnouncementPreferencesRef.operationName;
console.log(name);
```

### Variables
The `GetMyAnnouncementPreferences` query has no variables.
### Return Type
Recall that executing the `GetMyAnnouncementPreferences` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyAnnouncementPreferencesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyAnnouncementPreferencesData {
  user?: {
    membershipStatus: MembershipStatus;
    userGroups: ({
      userGroup: {
        membershipStatuses?: MembershipStatus[] | null;
        purposeLinks: ({
          purposes?: SectionUserGroupPurpose[] | null;
          section: {
            id: UUIDString;
            name: string;
          } & Section_Key;
        })[];
      };
    })[];
    optOuts: ({
      section: {
        id: UUIDString;
      } & Section_Key;
    })[];
  };
  allUserGroups: ({
    membershipStatuses?: MembershipStatus[] | null;
    purposeLinks: ({
      purposes?: SectionUserGroupPurpose[] | null;
      section: {
        id: UUIDString;
        name: string;
      } & Section_Key;
    })[];
  })[];
}
```
### Using `GetMyAnnouncementPreferences`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyAnnouncementPreferences } from '@dataconnect/generated';


// Call the `getMyAnnouncementPreferences()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyAnnouncementPreferences();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyAnnouncementPreferences(dataConnect);

console.log(data.user);
console.log(data.allUserGroups);

// Or, you can use the `Promise` API.
getMyAnnouncementPreferences().then((response) => {
  const data = response.data;
  console.log(data.user);
  console.log(data.allUserGroups);
});
```

### Using `GetMyAnnouncementPreferences`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyAnnouncementPreferencesRef } from '@dataconnect/generated';


// Call the `getMyAnnouncementPreferencesRef()` function to get a reference to the query.
const ref = getMyAnnouncementPreferencesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyAnnouncementPreferencesRef(dataConnect);

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

## UpdateUserStripeCustomerId
You can execute the `UpdateUserStripeCustomerId` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUserStripeCustomerId(vars: UpdateUserStripeCustomerIdVariables): MutationPromise<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;

interface UpdateUserStripeCustomerIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserStripeCustomerIdVariables): MutationRef<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;
}
export const updateUserStripeCustomerIdRef: UpdateUserStripeCustomerIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUserStripeCustomerId(dc: DataConnect, vars: UpdateUserStripeCustomerIdVariables): MutationPromise<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;

interface UpdateUserStripeCustomerIdRef {
  ...
  (dc: DataConnect, vars: UpdateUserStripeCustomerIdVariables): MutationRef<UpdateUserStripeCustomerIdData, UpdateUserStripeCustomerIdVariables>;
}
export const updateUserStripeCustomerIdRef: UpdateUserStripeCustomerIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserStripeCustomerIdRef:
```typescript
const name = updateUserStripeCustomerIdRef.operationName;
console.log(name);
```

### Variables
The `UpdateUserStripeCustomerId` mutation requires an argument of type `UpdateUserStripeCustomerIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserStripeCustomerIdVariables {
  userId: string;
  stripeCustomerId: string;
}
```
### Return Type
Recall that executing the `UpdateUserStripeCustomerId` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserStripeCustomerIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserStripeCustomerIdData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUserStripeCustomerId`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUserStripeCustomerId, UpdateUserStripeCustomerIdVariables } from '@dataconnect/generated';

// The `UpdateUserStripeCustomerId` mutation requires an argument of type `UpdateUserStripeCustomerIdVariables`:
const updateUserStripeCustomerIdVars: UpdateUserStripeCustomerIdVariables = {
  userId: ..., 
  stripeCustomerId: ..., 
};

// Call the `updateUserStripeCustomerId()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUserStripeCustomerId(updateUserStripeCustomerIdVars);
// Variables can be defined inline as well.
const { data } = await updateUserStripeCustomerId({ userId: ..., stripeCustomerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUserStripeCustomerId(dataConnect, updateUserStripeCustomerIdVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUserStripeCustomerId(updateUserStripeCustomerIdVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUserStripeCustomerId`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserStripeCustomerIdRef, UpdateUserStripeCustomerIdVariables } from '@dataconnect/generated';

// The `UpdateUserStripeCustomerId` mutation requires an argument of type `UpdateUserStripeCustomerIdVariables`:
const updateUserStripeCustomerIdVars: UpdateUserStripeCustomerIdVariables = {
  userId: ..., 
  stripeCustomerId: ..., 
};

// Call the `updateUserStripeCustomerIdRef()` function to get a reference to the mutation.
const ref = updateUserStripeCustomerIdRef(updateUserStripeCustomerIdVars);
// Variables can be defined inline as well.
const ref = updateUserStripeCustomerIdRef({ userId: ..., stripeCustomerId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserStripeCustomerIdRef(dataConnect, updateUserStripeCustomerIdVars);

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

## CreateBookingDraftForUser
You can execute the `CreateBookingDraftForUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createBookingDraftForUser(vars: CreateBookingDraftForUserVariables): MutationPromise<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;

interface CreateBookingDraftForUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingDraftForUserVariables): MutationRef<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;
}
export const createBookingDraftForUserRef: CreateBookingDraftForUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createBookingDraftForUser(dc: DataConnect, vars: CreateBookingDraftForUserVariables): MutationPromise<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;

interface CreateBookingDraftForUserRef {
  ...
  (dc: DataConnect, vars: CreateBookingDraftForUserVariables): MutationRef<CreateBookingDraftForUserData, CreateBookingDraftForUserVariables>;
}
export const createBookingDraftForUserRef: CreateBookingDraftForUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createBookingDraftForUserRef:
```typescript
const name = createBookingDraftForUserRef.operationName;
console.log(name);
```

### Variables
The `CreateBookingDraftForUser` mutation requires an argument of type `CreateBookingDraftForUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateBookingDraftForUserVariables {
  eventId: UUIDString;
  bookerId: string;
  clientSubmissionKey: string;
}
```
### Return Type
Recall that executing the `CreateBookingDraftForUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateBookingDraftForUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateBookingDraftForUserData {
  booking_insert: Booking_Key;
}
```
### Using `CreateBookingDraftForUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createBookingDraftForUser, CreateBookingDraftForUserVariables } from '@dataconnect/generated';

// The `CreateBookingDraftForUser` mutation requires an argument of type `CreateBookingDraftForUserVariables`:
const createBookingDraftForUserVars: CreateBookingDraftForUserVariables = {
  eventId: ..., 
  bookerId: ..., 
  clientSubmissionKey: ..., 
};

// Call the `createBookingDraftForUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createBookingDraftForUser(createBookingDraftForUserVars);
// Variables can be defined inline as well.
const { data } = await createBookingDraftForUser({ eventId: ..., bookerId: ..., clientSubmissionKey: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createBookingDraftForUser(dataConnect, createBookingDraftForUserVars);

console.log(data.booking_insert);

// Or, you can use the `Promise` API.
createBookingDraftForUser(createBookingDraftForUserVars).then((response) => {
  const data = response.data;
  console.log(data.booking_insert);
});
```

### Using `CreateBookingDraftForUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createBookingDraftForUserRef, CreateBookingDraftForUserVariables } from '@dataconnect/generated';

// The `CreateBookingDraftForUser` mutation requires an argument of type `CreateBookingDraftForUserVariables`:
const createBookingDraftForUserVars: CreateBookingDraftForUserVariables = {
  eventId: ..., 
  bookerId: ..., 
  clientSubmissionKey: ..., 
};

// Call the `createBookingDraftForUserRef()` function to get a reference to the mutation.
const ref = createBookingDraftForUserRef(createBookingDraftForUserVars);
// Variables can be defined inline as well.
const ref = createBookingDraftForUserRef({ eventId: ..., bookerId: ..., clientSubmissionKey: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createBookingDraftForUserRef(dataConnect, createBookingDraftForUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_insert);
});
```

## CreateBookingDraftRevisionForUser
You can execute the `CreateBookingDraftRevisionForUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createBookingDraftRevisionForUser(vars: CreateBookingDraftRevisionForUserVariables): MutationPromise<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;

interface CreateBookingDraftRevisionForUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingDraftRevisionForUserVariables): MutationRef<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;
}
export const createBookingDraftRevisionForUserRef: CreateBookingDraftRevisionForUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createBookingDraftRevisionForUser(dc: DataConnect, vars: CreateBookingDraftRevisionForUserVariables): MutationPromise<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;

interface CreateBookingDraftRevisionForUserRef {
  ...
  (dc: DataConnect, vars: CreateBookingDraftRevisionForUserVariables): MutationRef<CreateBookingDraftRevisionForUserData, CreateBookingDraftRevisionForUserVariables>;
}
export const createBookingDraftRevisionForUserRef: CreateBookingDraftRevisionForUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createBookingDraftRevisionForUserRef:
```typescript
const name = createBookingDraftRevisionForUserRef.operationName;
console.log(name);
```

### Variables
The `CreateBookingDraftRevisionForUser` mutation requires an argument of type `CreateBookingDraftRevisionForUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateBookingDraftRevisionForUserVariables {
  eventId: UUIDString;
  bookerId: string;
  clientSubmissionKey: string;
  revisionGroupId: UUIDString;
  revisionNumber: number;
  supersedesBookingId: UUIDString;
}
```
### Return Type
Recall that executing the `CreateBookingDraftRevisionForUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateBookingDraftRevisionForUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateBookingDraftRevisionForUserData {
  booking_insert: Booking_Key;
}
```
### Using `CreateBookingDraftRevisionForUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createBookingDraftRevisionForUser, CreateBookingDraftRevisionForUserVariables } from '@dataconnect/generated';

// The `CreateBookingDraftRevisionForUser` mutation requires an argument of type `CreateBookingDraftRevisionForUserVariables`:
const createBookingDraftRevisionForUserVars: CreateBookingDraftRevisionForUserVariables = {
  eventId: ..., 
  bookerId: ..., 
  clientSubmissionKey: ..., 
  revisionGroupId: ..., 
  revisionNumber: ..., 
  supersedesBookingId: ..., 
};

// Call the `createBookingDraftRevisionForUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createBookingDraftRevisionForUser(createBookingDraftRevisionForUserVars);
// Variables can be defined inline as well.
const { data } = await createBookingDraftRevisionForUser({ eventId: ..., bookerId: ..., clientSubmissionKey: ..., revisionGroupId: ..., revisionNumber: ..., supersedesBookingId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createBookingDraftRevisionForUser(dataConnect, createBookingDraftRevisionForUserVars);

console.log(data.booking_insert);

// Or, you can use the `Promise` API.
createBookingDraftRevisionForUser(createBookingDraftRevisionForUserVars).then((response) => {
  const data = response.data;
  console.log(data.booking_insert);
});
```

### Using `CreateBookingDraftRevisionForUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createBookingDraftRevisionForUserRef, CreateBookingDraftRevisionForUserVariables } from '@dataconnect/generated';

// The `CreateBookingDraftRevisionForUser` mutation requires an argument of type `CreateBookingDraftRevisionForUserVariables`:
const createBookingDraftRevisionForUserVars: CreateBookingDraftRevisionForUserVariables = {
  eventId: ..., 
  bookerId: ..., 
  clientSubmissionKey: ..., 
  revisionGroupId: ..., 
  revisionNumber: ..., 
  supersedesBookingId: ..., 
};

// Call the `createBookingDraftRevisionForUserRef()` function to get a reference to the mutation.
const ref = createBookingDraftRevisionForUserRef(createBookingDraftRevisionForUserVars);
// Variables can be defined inline as well.
const ref = createBookingDraftRevisionForUserRef({ eventId: ..., bookerId: ..., clientSubmissionKey: ..., revisionGroupId: ..., revisionNumber: ..., supersedesBookingId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createBookingDraftRevisionForUserRef(dataConnect, createBookingDraftRevisionForUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_insert);
});
```

## MarkBookingSupersededFromCallable
You can execute the `MarkBookingSupersededFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markBookingSupersededFromCallable(vars: MarkBookingSupersededFromCallableVariables): MutationPromise<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;

interface MarkBookingSupersededFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkBookingSupersededFromCallableVariables): MutationRef<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;
}
export const markBookingSupersededFromCallableRef: MarkBookingSupersededFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markBookingSupersededFromCallable(dc: DataConnect, vars: MarkBookingSupersededFromCallableVariables): MutationPromise<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;

interface MarkBookingSupersededFromCallableRef {
  ...
  (dc: DataConnect, vars: MarkBookingSupersededFromCallableVariables): MutationRef<MarkBookingSupersededFromCallableData, MarkBookingSupersededFromCallableVariables>;
}
export const markBookingSupersededFromCallableRef: MarkBookingSupersededFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markBookingSupersededFromCallableRef:
```typescript
const name = markBookingSupersededFromCallableRef.operationName;
console.log(name);
```

### Variables
The `MarkBookingSupersededFromCallable` mutation requires an argument of type `MarkBookingSupersededFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkBookingSupersededFromCallableVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `MarkBookingSupersededFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkBookingSupersededFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkBookingSupersededFromCallableData {
  booking_update?: Booking_Key | null;
}
```
### Using `MarkBookingSupersededFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markBookingSupersededFromCallable, MarkBookingSupersededFromCallableVariables } from '@dataconnect/generated';

// The `MarkBookingSupersededFromCallable` mutation requires an argument of type `MarkBookingSupersededFromCallableVariables`:
const markBookingSupersededFromCallableVars: MarkBookingSupersededFromCallableVariables = {
  id: ..., 
};

// Call the `markBookingSupersededFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markBookingSupersededFromCallable(markBookingSupersededFromCallableVars);
// Variables can be defined inline as well.
const { data } = await markBookingSupersededFromCallable({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markBookingSupersededFromCallable(dataConnect, markBookingSupersededFromCallableVars);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
markBookingSupersededFromCallable(markBookingSupersededFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

### Using `MarkBookingSupersededFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markBookingSupersededFromCallableRef, MarkBookingSupersededFromCallableVariables } from '@dataconnect/generated';

// The `MarkBookingSupersededFromCallable` mutation requires an argument of type `MarkBookingSupersededFromCallableVariables`:
const markBookingSupersededFromCallableVars: MarkBookingSupersededFromCallableVariables = {
  id: ..., 
};

// Call the `markBookingSupersededFromCallableRef()` function to get a reference to the mutation.
const ref = markBookingSupersededFromCallableRef(markBookingSupersededFromCallableVars);
// Variables can be defined inline as well.
const ref = markBookingSupersededFromCallableRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markBookingSupersededFromCallableRef(dataConnect, markBookingSupersededFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

## CreateBookingPaymentAdjustmentFromCallable
You can execute the `CreateBookingPaymentAdjustmentFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createBookingPaymentAdjustmentFromCallable(vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationPromise<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;

interface CreateBookingPaymentAdjustmentFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationRef<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;
}
export const createBookingPaymentAdjustmentFromCallableRef: CreateBookingPaymentAdjustmentFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createBookingPaymentAdjustmentFromCallable(dc: DataConnect, vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationPromise<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;

interface CreateBookingPaymentAdjustmentFromCallableRef {
  ...
  (dc: DataConnect, vars: CreateBookingPaymentAdjustmentFromCallableVariables): MutationRef<CreateBookingPaymentAdjustmentFromCallableData, CreateBookingPaymentAdjustmentFromCallableVariables>;
}
export const createBookingPaymentAdjustmentFromCallableRef: CreateBookingPaymentAdjustmentFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createBookingPaymentAdjustmentFromCallableRef:
```typescript
const name = createBookingPaymentAdjustmentFromCallableRef.operationName;
console.log(name);
```

### Variables
The `CreateBookingPaymentAdjustmentFromCallable` mutation requires an argument of type `CreateBookingPaymentAdjustmentFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateBookingPaymentAdjustmentFromCallableVariables {
  revisionBookingId: UUIDString;
  supersededBookingId: UUIDString;
  deltaAmountMinor: number;
  status: BookingPaymentAdjustmentStatus;
  orchestrationKey: string;
}
```
### Return Type
Recall that executing the `CreateBookingPaymentAdjustmentFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateBookingPaymentAdjustmentFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateBookingPaymentAdjustmentFromCallableData {
  bookingPaymentAdjustment_upsert: BookingPaymentAdjustment_Key;
}
```
### Using `CreateBookingPaymentAdjustmentFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createBookingPaymentAdjustmentFromCallable, CreateBookingPaymentAdjustmentFromCallableVariables } from '@dataconnect/generated';

// The `CreateBookingPaymentAdjustmentFromCallable` mutation requires an argument of type `CreateBookingPaymentAdjustmentFromCallableVariables`:
const createBookingPaymentAdjustmentFromCallableVars: CreateBookingPaymentAdjustmentFromCallableVariables = {
  revisionBookingId: ..., 
  supersededBookingId: ..., 
  deltaAmountMinor: ..., 
  status: ..., 
  orchestrationKey: ..., 
};

// Call the `createBookingPaymentAdjustmentFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createBookingPaymentAdjustmentFromCallable(createBookingPaymentAdjustmentFromCallableVars);
// Variables can be defined inline as well.
const { data } = await createBookingPaymentAdjustmentFromCallable({ revisionBookingId: ..., supersededBookingId: ..., deltaAmountMinor: ..., status: ..., orchestrationKey: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createBookingPaymentAdjustmentFromCallable(dataConnect, createBookingPaymentAdjustmentFromCallableVars);

console.log(data.bookingPaymentAdjustment_upsert);

// Or, you can use the `Promise` API.
createBookingPaymentAdjustmentFromCallable(createBookingPaymentAdjustmentFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.bookingPaymentAdjustment_upsert);
});
```

### Using `CreateBookingPaymentAdjustmentFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createBookingPaymentAdjustmentFromCallableRef, CreateBookingPaymentAdjustmentFromCallableVariables } from '@dataconnect/generated';

// The `CreateBookingPaymentAdjustmentFromCallable` mutation requires an argument of type `CreateBookingPaymentAdjustmentFromCallableVariables`:
const createBookingPaymentAdjustmentFromCallableVars: CreateBookingPaymentAdjustmentFromCallableVariables = {
  revisionBookingId: ..., 
  supersededBookingId: ..., 
  deltaAmountMinor: ..., 
  status: ..., 
  orchestrationKey: ..., 
};

// Call the `createBookingPaymentAdjustmentFromCallableRef()` function to get a reference to the mutation.
const ref = createBookingPaymentAdjustmentFromCallableRef(createBookingPaymentAdjustmentFromCallableVars);
// Variables can be defined inline as well.
const ref = createBookingPaymentAdjustmentFromCallableRef({ revisionBookingId: ..., supersededBookingId: ..., deltaAmountMinor: ..., status: ..., orchestrationKey: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createBookingPaymentAdjustmentFromCallableRef(dataConnect, createBookingPaymentAdjustmentFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.bookingPaymentAdjustment_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.bookingPaymentAdjustment_upsert);
});
```

## AddBookingLineFromCallable
You can execute the `AddBookingLineFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addBookingLineFromCallable(vars: AddBookingLineFromCallableVariables): MutationPromise<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;

interface AddBookingLineFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddBookingLineFromCallableVariables): MutationRef<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;
}
export const addBookingLineFromCallableRef: AddBookingLineFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addBookingLineFromCallable(dc: DataConnect, vars: AddBookingLineFromCallableVariables): MutationPromise<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;

interface AddBookingLineFromCallableRef {
  ...
  (dc: DataConnect, vars: AddBookingLineFromCallableVariables): MutationRef<AddBookingLineFromCallableData, AddBookingLineFromCallableVariables>;
}
export const addBookingLineFromCallableRef: AddBookingLineFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addBookingLineFromCallableRef:
```typescript
const name = addBookingLineFromCallableRef.operationName;
console.log(name);
```

### Variables
The `AddBookingLineFromCallable` mutation requires an argument of type `AddBookingLineFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddBookingLineFromCallableVariables {
  bookingId: UUIDString;
  ticketTypeId: UUIDString;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
  sortOrder: number;
}
```
### Return Type
Recall that executing the `AddBookingLineFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddBookingLineFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddBookingLineFromCallableData {
  bookingLine_insert: BookingLine_Key;
}
```
### Using `AddBookingLineFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addBookingLineFromCallable, AddBookingLineFromCallableVariables } from '@dataconnect/generated';

// The `AddBookingLineFromCallable` mutation requires an argument of type `AddBookingLineFromCallableVariables`:
const addBookingLineFromCallableVars: AddBookingLineFromCallableVariables = {
  bookingId: ..., 
  ticketTypeId: ..., 
  guestUserId: ..., // optional
  guestDisplayName: ..., // optional
  dietaryNote: ..., // optional
  sortOrder: ..., 
};

// Call the `addBookingLineFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addBookingLineFromCallable(addBookingLineFromCallableVars);
// Variables can be defined inline as well.
const { data } = await addBookingLineFromCallable({ bookingId: ..., ticketTypeId: ..., guestUserId: ..., guestDisplayName: ..., dietaryNote: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addBookingLineFromCallable(dataConnect, addBookingLineFromCallableVars);

console.log(data.bookingLine_insert);

// Or, you can use the `Promise` API.
addBookingLineFromCallable(addBookingLineFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_insert);
});
```

### Using `AddBookingLineFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addBookingLineFromCallableRef, AddBookingLineFromCallableVariables } from '@dataconnect/generated';

// The `AddBookingLineFromCallable` mutation requires an argument of type `AddBookingLineFromCallableVariables`:
const addBookingLineFromCallableVars: AddBookingLineFromCallableVariables = {
  bookingId: ..., 
  ticketTypeId: ..., 
  guestUserId: ..., // optional
  guestDisplayName: ..., // optional
  dietaryNote: ..., // optional
  sortOrder: ..., 
};

// Call the `addBookingLineFromCallableRef()` function to get a reference to the mutation.
const ref = addBookingLineFromCallableRef(addBookingLineFromCallableVars);
// Variables can be defined inline as well.
const ref = addBookingLineFromCallableRef({ bookingId: ..., ticketTypeId: ..., guestUserId: ..., guestDisplayName: ..., dietaryNote: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addBookingLineFromCallableRef(dataConnect, addBookingLineFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.bookingLine_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_insert);
});
```

## UpdateBookingStatusFromCallable
You can execute the `UpdateBookingStatusFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateBookingStatusFromCallable(vars: UpdateBookingStatusFromCallableVariables): MutationPromise<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;

interface UpdateBookingStatusFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingStatusFromCallableVariables): MutationRef<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;
}
export const updateBookingStatusFromCallableRef: UpdateBookingStatusFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateBookingStatusFromCallable(dc: DataConnect, vars: UpdateBookingStatusFromCallableVariables): MutationPromise<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;

interface UpdateBookingStatusFromCallableRef {
  ...
  (dc: DataConnect, vars: UpdateBookingStatusFromCallableVariables): MutationRef<UpdateBookingStatusFromCallableData, UpdateBookingStatusFromCallableVariables>;
}
export const updateBookingStatusFromCallableRef: UpdateBookingStatusFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateBookingStatusFromCallableRef:
```typescript
const name = updateBookingStatusFromCallableRef.operationName;
console.log(name);
```

### Variables
The `UpdateBookingStatusFromCallable` mutation requires an argument of type `UpdateBookingStatusFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateBookingStatusFromCallableVariables {
  id: UUIDString;
  status: BookingStatus;
}
```
### Return Type
Recall that executing the `UpdateBookingStatusFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateBookingStatusFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateBookingStatusFromCallableData {
  booking_update?: Booking_Key | null;
}
```
### Using `UpdateBookingStatusFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateBookingStatusFromCallable, UpdateBookingStatusFromCallableVariables } from '@dataconnect/generated';

// The `UpdateBookingStatusFromCallable` mutation requires an argument of type `UpdateBookingStatusFromCallableVariables`:
const updateBookingStatusFromCallableVars: UpdateBookingStatusFromCallableVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateBookingStatusFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateBookingStatusFromCallable(updateBookingStatusFromCallableVars);
// Variables can be defined inline as well.
const { data } = await updateBookingStatusFromCallable({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateBookingStatusFromCallable(dataConnect, updateBookingStatusFromCallableVars);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
updateBookingStatusFromCallable(updateBookingStatusFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

### Using `UpdateBookingStatusFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateBookingStatusFromCallableRef, UpdateBookingStatusFromCallableVariables } from '@dataconnect/generated';

// The `UpdateBookingStatusFromCallable` mutation requires an argument of type `UpdateBookingStatusFromCallableVariables`:
const updateBookingStatusFromCallableVars: UpdateBookingStatusFromCallableVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateBookingStatusFromCallableRef()` function to get a reference to the mutation.
const ref = updateBookingStatusFromCallableRef(updateBookingStatusFromCallableVars);
// Variables can be defined inline as well.
const ref = updateBookingStatusFromCallableRef({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateBookingStatusFromCallableRef(dataConnect, updateBookingStatusFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

## CreateTicketOrderForCheckout
You can execute the `CreateTicketOrderForCheckout` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createTicketOrderForCheckout(vars: CreateTicketOrderForCheckoutVariables): MutationPromise<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;

interface CreateTicketOrderForCheckoutRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTicketOrderForCheckoutVariables): MutationRef<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;
}
export const createTicketOrderForCheckoutRef: CreateTicketOrderForCheckoutRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createTicketOrderForCheckout(dc: DataConnect, vars: CreateTicketOrderForCheckoutVariables): MutationPromise<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;

interface CreateTicketOrderForCheckoutRef {
  ...
  (dc: DataConnect, vars: CreateTicketOrderForCheckoutVariables): MutationRef<CreateTicketOrderForCheckoutData, CreateTicketOrderForCheckoutVariables>;
}
export const createTicketOrderForCheckoutRef: CreateTicketOrderForCheckoutRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createTicketOrderForCheckoutRef:
```typescript
const name = createTicketOrderForCheckoutRef.operationName;
console.log(name);
```

### Variables
The `CreateTicketOrderForCheckout` mutation requires an argument of type `CreateTicketOrderForCheckoutVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateTicketOrderForCheckoutVariables {
  userId: string;
  eventId: UUIDString;
  ticketTypeId: UUIDString;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  currency: string;
}
```
### Return Type
Recall that executing the `CreateTicketOrderForCheckout` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateTicketOrderForCheckoutData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateTicketOrderForCheckoutData {
  ticketOrder_insert: TicketOrder_Key;
}
```
### Using `CreateTicketOrderForCheckout`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createTicketOrderForCheckout, CreateTicketOrderForCheckoutVariables } from '@dataconnect/generated';

// The `CreateTicketOrderForCheckout` mutation requires an argument of type `CreateTicketOrderForCheckoutVariables`:
const createTicketOrderForCheckoutVars: CreateTicketOrderForCheckoutVariables = {
  userId: ..., 
  eventId: ..., 
  ticketTypeId: ..., 
  quantity: ..., 
  unitAmountMinor: ..., 
  totalAmountMinor: ..., 
  currency: ..., 
};

// Call the `createTicketOrderForCheckout()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createTicketOrderForCheckout(createTicketOrderForCheckoutVars);
// Variables can be defined inline as well.
const { data } = await createTicketOrderForCheckout({ userId: ..., eventId: ..., ticketTypeId: ..., quantity: ..., unitAmountMinor: ..., totalAmountMinor: ..., currency: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createTicketOrderForCheckout(dataConnect, createTicketOrderForCheckoutVars);

console.log(data.ticketOrder_insert);

// Or, you can use the `Promise` API.
createTicketOrderForCheckout(createTicketOrderForCheckoutVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_insert);
});
```

### Using `CreateTicketOrderForCheckout`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createTicketOrderForCheckoutRef, CreateTicketOrderForCheckoutVariables } from '@dataconnect/generated';

// The `CreateTicketOrderForCheckout` mutation requires an argument of type `CreateTicketOrderForCheckoutVariables`:
const createTicketOrderForCheckoutVars: CreateTicketOrderForCheckoutVariables = {
  userId: ..., 
  eventId: ..., 
  ticketTypeId: ..., 
  quantity: ..., 
  unitAmountMinor: ..., 
  totalAmountMinor: ..., 
  currency: ..., 
};

// Call the `createTicketOrderForCheckoutRef()` function to get a reference to the mutation.
const ref = createTicketOrderForCheckoutRef(createTicketOrderForCheckoutVars);
// Variables can be defined inline as well.
const ref = createTicketOrderForCheckoutRef({ userId: ..., eventId: ..., ticketTypeId: ..., quantity: ..., unitAmountMinor: ..., totalAmountMinor: ..., currency: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createTicketOrderForCheckoutRef(dataConnect, createTicketOrderForCheckoutVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketOrder_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_insert);
});
```

## CreatePaymentWebhookEvent
You can execute the `CreatePaymentWebhookEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPaymentWebhookEvent(vars: CreatePaymentWebhookEventVariables): MutationPromise<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;

interface CreatePaymentWebhookEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePaymentWebhookEventVariables): MutationRef<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;
}
export const createPaymentWebhookEventRef: CreatePaymentWebhookEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPaymentWebhookEvent(dc: DataConnect, vars: CreatePaymentWebhookEventVariables): MutationPromise<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;

interface CreatePaymentWebhookEventRef {
  ...
  (dc: DataConnect, vars: CreatePaymentWebhookEventVariables): MutationRef<CreatePaymentWebhookEventData, CreatePaymentWebhookEventVariables>;
}
export const createPaymentWebhookEventRef: CreatePaymentWebhookEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPaymentWebhookEventRef:
```typescript
const name = createPaymentWebhookEventRef.operationName;
console.log(name);
```

### Variables
The `CreatePaymentWebhookEvent` mutation requires an argument of type `CreatePaymentWebhookEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreatePaymentWebhookEventVariables {
  stripeEventId: string;
  eventType: string;
  outcome: PaymentWebhookEventOutcome;
  reason?: string | null;
  ticketOrderId?: UUIDString | null;
  stripeObjectId?: string | null;
  livemode: boolean;
}
```
### Return Type
Recall that executing the `CreatePaymentWebhookEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePaymentWebhookEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePaymentWebhookEventData {
  paymentWebhookEvent_insert: PaymentWebhookEvent_Key;
}
```
### Using `CreatePaymentWebhookEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPaymentWebhookEvent, CreatePaymentWebhookEventVariables } from '@dataconnect/generated';

// The `CreatePaymentWebhookEvent` mutation requires an argument of type `CreatePaymentWebhookEventVariables`:
const createPaymentWebhookEventVars: CreatePaymentWebhookEventVariables = {
  stripeEventId: ..., 
  eventType: ..., 
  outcome: ..., 
  reason: ..., // optional
  ticketOrderId: ..., // optional
  stripeObjectId: ..., // optional
  livemode: ..., 
};

// Call the `createPaymentWebhookEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPaymentWebhookEvent(createPaymentWebhookEventVars);
// Variables can be defined inline as well.
const { data } = await createPaymentWebhookEvent({ stripeEventId: ..., eventType: ..., outcome: ..., reason: ..., ticketOrderId: ..., stripeObjectId: ..., livemode: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPaymentWebhookEvent(dataConnect, createPaymentWebhookEventVars);

console.log(data.paymentWebhookEvent_insert);

// Or, you can use the `Promise` API.
createPaymentWebhookEvent(createPaymentWebhookEventVars).then((response) => {
  const data = response.data;
  console.log(data.paymentWebhookEvent_insert);
});
```

### Using `CreatePaymentWebhookEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPaymentWebhookEventRef, CreatePaymentWebhookEventVariables } from '@dataconnect/generated';

// The `CreatePaymentWebhookEvent` mutation requires an argument of type `CreatePaymentWebhookEventVariables`:
const createPaymentWebhookEventVars: CreatePaymentWebhookEventVariables = {
  stripeEventId: ..., 
  eventType: ..., 
  outcome: ..., 
  reason: ..., // optional
  ticketOrderId: ..., // optional
  stripeObjectId: ..., // optional
  livemode: ..., 
};

// Call the `createPaymentWebhookEventRef()` function to get a reference to the mutation.
const ref = createPaymentWebhookEventRef(createPaymentWebhookEventVars);
// Variables can be defined inline as well.
const ref = createPaymentWebhookEventRef({ stripeEventId: ..., eventType: ..., outcome: ..., reason: ..., ticketOrderId: ..., stripeObjectId: ..., livemode: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPaymentWebhookEventRef(dataConnect, createPaymentWebhookEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.paymentWebhookEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.paymentWebhookEvent_insert);
});
```

## CreateNotificationDelivery
You can execute the `CreateNotificationDelivery` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createNotificationDelivery(vars: CreateNotificationDeliveryVariables): MutationPromise<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;

interface CreateNotificationDeliveryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNotificationDeliveryVariables): MutationRef<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;
}
export const createNotificationDeliveryRef: CreateNotificationDeliveryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createNotificationDelivery(dc: DataConnect, vars: CreateNotificationDeliveryVariables): MutationPromise<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;

interface CreateNotificationDeliveryRef {
  ...
  (dc: DataConnect, vars: CreateNotificationDeliveryVariables): MutationRef<CreateNotificationDeliveryData, CreateNotificationDeliveryVariables>;
}
export const createNotificationDeliveryRef: CreateNotificationDeliveryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createNotificationDeliveryRef:
```typescript
const name = createNotificationDeliveryRef.operationName;
console.log(name);
```

### Variables
The `CreateNotificationDelivery` mutation requires an argument of type `CreateNotificationDeliveryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateNotificationDeliveryVariables {
  channel: NotificationChannel;
  notificationType: string;
  deliveryKey: string;
  status: NotificationDeliveryStatus;
  ticketOrderId?: UUIDString | null;
  bookingId?: UUIDString | null;
  userId?: string | null;
  provider?: string | null;
  attemptCount: number;
  lastAttemptedAt?: TimestampString | null;
}
```
### Return Type
Recall that executing the `CreateNotificationDelivery` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateNotificationDeliveryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateNotificationDeliveryData {
  notificationDelivery_insert: NotificationDelivery_Key;
}
```
### Using `CreateNotificationDelivery`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createNotificationDelivery, CreateNotificationDeliveryVariables } from '@dataconnect/generated';

// The `CreateNotificationDelivery` mutation requires an argument of type `CreateNotificationDeliveryVariables`:
const createNotificationDeliveryVars: CreateNotificationDeliveryVariables = {
  channel: ..., 
  notificationType: ..., 
  deliveryKey: ..., 
  status: ..., 
  ticketOrderId: ..., // optional
  bookingId: ..., // optional
  userId: ..., // optional
  provider: ..., // optional
  attemptCount: ..., 
  lastAttemptedAt: ..., // optional
};

// Call the `createNotificationDelivery()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createNotificationDelivery(createNotificationDeliveryVars);
// Variables can be defined inline as well.
const { data } = await createNotificationDelivery({ channel: ..., notificationType: ..., deliveryKey: ..., status: ..., ticketOrderId: ..., bookingId: ..., userId: ..., provider: ..., attemptCount: ..., lastAttemptedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createNotificationDelivery(dataConnect, createNotificationDeliveryVars);

console.log(data.notificationDelivery_insert);

// Or, you can use the `Promise` API.
createNotificationDelivery(createNotificationDeliveryVars).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_insert);
});
```

### Using `CreateNotificationDelivery`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createNotificationDeliveryRef, CreateNotificationDeliveryVariables } from '@dataconnect/generated';

// The `CreateNotificationDelivery` mutation requires an argument of type `CreateNotificationDeliveryVariables`:
const createNotificationDeliveryVars: CreateNotificationDeliveryVariables = {
  channel: ..., 
  notificationType: ..., 
  deliveryKey: ..., 
  status: ..., 
  ticketOrderId: ..., // optional
  bookingId: ..., // optional
  userId: ..., // optional
  provider: ..., // optional
  attemptCount: ..., 
  lastAttemptedAt: ..., // optional
};

// Call the `createNotificationDeliveryRef()` function to get a reference to the mutation.
const ref = createNotificationDeliveryRef(createNotificationDeliveryVars);
// Variables can be defined inline as well.
const ref = createNotificationDeliveryRef({ channel: ..., notificationType: ..., deliveryKey: ..., status: ..., ticketOrderId: ..., bookingId: ..., userId: ..., provider: ..., attemptCount: ..., lastAttemptedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createNotificationDeliveryRef(dataConnect, createNotificationDeliveryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.notificationDelivery_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_insert);
});
```

## MarkNotificationDeliveryPendingById
You can execute the `MarkNotificationDeliveryPendingById` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markNotificationDeliveryPendingById(vars: MarkNotificationDeliveryPendingByIdVariables): MutationPromise<MarkNotificationDeliveryPendingByIdData, MarkNotificationDeliveryPendingByIdVariables>;

interface MarkNotificationDeliveryPendingByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotificationDeliveryPendingByIdVariables): MutationRef<MarkNotificationDeliveryPendingByIdData, MarkNotificationDeliveryPendingByIdVariables>;
}
export const markNotificationDeliveryPendingByIdRef: MarkNotificationDeliveryPendingByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markNotificationDeliveryPendingById(dc: DataConnect, vars: MarkNotificationDeliveryPendingByIdVariables): MutationPromise<MarkNotificationDeliveryPendingByIdData, MarkNotificationDeliveryPendingByIdVariables>;

interface MarkNotificationDeliveryPendingByIdRef {
  ...
  (dc: DataConnect, vars: MarkNotificationDeliveryPendingByIdVariables): MutationRef<MarkNotificationDeliveryPendingByIdData, MarkNotificationDeliveryPendingByIdVariables>;
}
export const markNotificationDeliveryPendingByIdRef: MarkNotificationDeliveryPendingByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markNotificationDeliveryPendingByIdRef:
```typescript
const name = markNotificationDeliveryPendingByIdRef.operationName;
console.log(name);
```

### Variables
The `MarkNotificationDeliveryPendingById` mutation requires an argument of type `MarkNotificationDeliveryPendingByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkNotificationDeliveryPendingByIdVariables {
  id: UUIDString;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  provider?: string | null;
}
```
### Return Type
Recall that executing the `MarkNotificationDeliveryPendingById` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkNotificationDeliveryPendingByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkNotificationDeliveryPendingByIdData {
  notificationDelivery_update?: NotificationDelivery_Key | null;
}
```
### Using `MarkNotificationDeliveryPendingById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markNotificationDeliveryPendingById, MarkNotificationDeliveryPendingByIdVariables } from '@dataconnect/generated';

// The `MarkNotificationDeliveryPendingById` mutation requires an argument of type `MarkNotificationDeliveryPendingByIdVariables`:
const markNotificationDeliveryPendingByIdVars: MarkNotificationDeliveryPendingByIdVariables = {
  id: ..., 
  attemptCount: ..., 
  lastAttemptedAt: ..., 
  provider: ..., // optional
};

// Call the `markNotificationDeliveryPendingById()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markNotificationDeliveryPendingById(markNotificationDeliveryPendingByIdVars);
// Variables can be defined inline as well.
const { data } = await markNotificationDeliveryPendingById({ id: ..., attemptCount: ..., lastAttemptedAt: ..., provider: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markNotificationDeliveryPendingById(dataConnect, markNotificationDeliveryPendingByIdVars);

console.log(data.notificationDelivery_update);

// Or, you can use the `Promise` API.
markNotificationDeliveryPendingById(markNotificationDeliveryPendingByIdVars).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_update);
});
```

### Using `MarkNotificationDeliveryPendingById`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markNotificationDeliveryPendingByIdRef, MarkNotificationDeliveryPendingByIdVariables } from '@dataconnect/generated';

// The `MarkNotificationDeliveryPendingById` mutation requires an argument of type `MarkNotificationDeliveryPendingByIdVariables`:
const markNotificationDeliveryPendingByIdVars: MarkNotificationDeliveryPendingByIdVariables = {
  id: ..., 
  attemptCount: ..., 
  lastAttemptedAt: ..., 
  provider: ..., // optional
};

// Call the `markNotificationDeliveryPendingByIdRef()` function to get a reference to the mutation.
const ref = markNotificationDeliveryPendingByIdRef(markNotificationDeliveryPendingByIdVars);
// Variables can be defined inline as well.
const ref = markNotificationDeliveryPendingByIdRef({ id: ..., attemptCount: ..., lastAttemptedAt: ..., provider: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markNotificationDeliveryPendingByIdRef(dataConnect, markNotificationDeliveryPendingByIdVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.notificationDelivery_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_update);
});
```

## MarkNotificationDeliverySentById
You can execute the `MarkNotificationDeliverySentById` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markNotificationDeliverySentById(vars: MarkNotificationDeliverySentByIdVariables): MutationPromise<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;

interface MarkNotificationDeliverySentByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotificationDeliverySentByIdVariables): MutationRef<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;
}
export const markNotificationDeliverySentByIdRef: MarkNotificationDeliverySentByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markNotificationDeliverySentById(dc: DataConnect, vars: MarkNotificationDeliverySentByIdVariables): MutationPromise<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;

interface MarkNotificationDeliverySentByIdRef {
  ...
  (dc: DataConnect, vars: MarkNotificationDeliverySentByIdVariables): MutationRef<MarkNotificationDeliverySentByIdData, MarkNotificationDeliverySentByIdVariables>;
}
export const markNotificationDeliverySentByIdRef: MarkNotificationDeliverySentByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markNotificationDeliverySentByIdRef:
```typescript
const name = markNotificationDeliverySentByIdRef.operationName;
console.log(name);
```

### Variables
The `MarkNotificationDeliverySentById` mutation requires an argument of type `MarkNotificationDeliverySentByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkNotificationDeliverySentByIdVariables {
  id: UUIDString;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  sentAt: TimestampString;
  provider?: string | null;
  providerMessageId?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}
```
### Return Type
Recall that executing the `MarkNotificationDeliverySentById` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkNotificationDeliverySentByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkNotificationDeliverySentByIdData {
  notificationDelivery_update?: NotificationDelivery_Key | null;
}
```
### Using `MarkNotificationDeliverySentById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markNotificationDeliverySentById, MarkNotificationDeliverySentByIdVariables } from '@dataconnect/generated';

// The `MarkNotificationDeliverySentById` mutation requires an argument of type `MarkNotificationDeliverySentByIdVariables`:
const markNotificationDeliverySentByIdVars: MarkNotificationDeliverySentByIdVariables = {
  id: ..., 
  attemptCount: ..., 
  lastAttemptedAt: ..., 
  sentAt: ..., 
  provider: ..., // optional
  providerMessageId: ..., // optional
  lastErrorCode: ..., // optional
  lastErrorMessage: ..., // optional
};

// Call the `markNotificationDeliverySentById()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markNotificationDeliverySentById(markNotificationDeliverySentByIdVars);
// Variables can be defined inline as well.
const { data } = await markNotificationDeliverySentById({ id: ..., attemptCount: ..., lastAttemptedAt: ..., sentAt: ..., provider: ..., providerMessageId: ..., lastErrorCode: ..., lastErrorMessage: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markNotificationDeliverySentById(dataConnect, markNotificationDeliverySentByIdVars);

console.log(data.notificationDelivery_update);

// Or, you can use the `Promise` API.
markNotificationDeliverySentById(markNotificationDeliverySentByIdVars).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_update);
});
```

### Using `MarkNotificationDeliverySentById`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markNotificationDeliverySentByIdRef, MarkNotificationDeliverySentByIdVariables } from '@dataconnect/generated';

// The `MarkNotificationDeliverySentById` mutation requires an argument of type `MarkNotificationDeliverySentByIdVariables`:
const markNotificationDeliverySentByIdVars: MarkNotificationDeliverySentByIdVariables = {
  id: ..., 
  attemptCount: ..., 
  lastAttemptedAt: ..., 
  sentAt: ..., 
  provider: ..., // optional
  providerMessageId: ..., // optional
  lastErrorCode: ..., // optional
  lastErrorMessage: ..., // optional
};

// Call the `markNotificationDeliverySentByIdRef()` function to get a reference to the mutation.
const ref = markNotificationDeliverySentByIdRef(markNotificationDeliverySentByIdVars);
// Variables can be defined inline as well.
const ref = markNotificationDeliverySentByIdRef({ id: ..., attemptCount: ..., lastAttemptedAt: ..., sentAt: ..., provider: ..., providerMessageId: ..., lastErrorCode: ..., lastErrorMessage: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markNotificationDeliverySentByIdRef(dataConnect, markNotificationDeliverySentByIdVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.notificationDelivery_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_update);
});
```

## MarkNotificationDeliveryFailedById
You can execute the `MarkNotificationDeliveryFailedById` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markNotificationDeliveryFailedById(vars: MarkNotificationDeliveryFailedByIdVariables): MutationPromise<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;

interface MarkNotificationDeliveryFailedByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotificationDeliveryFailedByIdVariables): MutationRef<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;
}
export const markNotificationDeliveryFailedByIdRef: MarkNotificationDeliveryFailedByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markNotificationDeliveryFailedById(dc: DataConnect, vars: MarkNotificationDeliveryFailedByIdVariables): MutationPromise<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;

interface MarkNotificationDeliveryFailedByIdRef {
  ...
  (dc: DataConnect, vars: MarkNotificationDeliveryFailedByIdVariables): MutationRef<MarkNotificationDeliveryFailedByIdData, MarkNotificationDeliveryFailedByIdVariables>;
}
export const markNotificationDeliveryFailedByIdRef: MarkNotificationDeliveryFailedByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markNotificationDeliveryFailedByIdRef:
```typescript
const name = markNotificationDeliveryFailedByIdRef.operationName;
console.log(name);
```

### Variables
The `MarkNotificationDeliveryFailedById` mutation requires an argument of type `MarkNotificationDeliveryFailedByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkNotificationDeliveryFailedByIdVariables {
  id: UUIDString;
  attemptCount: number;
  lastAttemptedAt: TimestampString;
  provider?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}
```
### Return Type
Recall that executing the `MarkNotificationDeliveryFailedById` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkNotificationDeliveryFailedByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkNotificationDeliveryFailedByIdData {
  notificationDelivery_update?: NotificationDelivery_Key | null;
}
```
### Using `MarkNotificationDeliveryFailedById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markNotificationDeliveryFailedById, MarkNotificationDeliveryFailedByIdVariables } from '@dataconnect/generated';

// The `MarkNotificationDeliveryFailedById` mutation requires an argument of type `MarkNotificationDeliveryFailedByIdVariables`:
const markNotificationDeliveryFailedByIdVars: MarkNotificationDeliveryFailedByIdVariables = {
  id: ..., 
  attemptCount: ..., 
  lastAttemptedAt: ..., 
  provider: ..., // optional
  lastErrorCode: ..., // optional
  lastErrorMessage: ..., // optional
};

// Call the `markNotificationDeliveryFailedById()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markNotificationDeliveryFailedById(markNotificationDeliveryFailedByIdVars);
// Variables can be defined inline as well.
const { data } = await markNotificationDeliveryFailedById({ id: ..., attemptCount: ..., lastAttemptedAt: ..., provider: ..., lastErrorCode: ..., lastErrorMessage: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markNotificationDeliveryFailedById(dataConnect, markNotificationDeliveryFailedByIdVars);

console.log(data.notificationDelivery_update);

// Or, you can use the `Promise` API.
markNotificationDeliveryFailedById(markNotificationDeliveryFailedByIdVars).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_update);
});
```

### Using `MarkNotificationDeliveryFailedById`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markNotificationDeliveryFailedByIdRef, MarkNotificationDeliveryFailedByIdVariables } from '@dataconnect/generated';

// The `MarkNotificationDeliveryFailedById` mutation requires an argument of type `MarkNotificationDeliveryFailedByIdVariables`:
const markNotificationDeliveryFailedByIdVars: MarkNotificationDeliveryFailedByIdVariables = {
  id: ..., 
  attemptCount: ..., 
  lastAttemptedAt: ..., 
  provider: ..., // optional
  lastErrorCode: ..., // optional
  lastErrorMessage: ..., // optional
};

// Call the `markNotificationDeliveryFailedByIdRef()` function to get a reference to the mutation.
const ref = markNotificationDeliveryFailedByIdRef(markNotificationDeliveryFailedByIdVars);
// Variables can be defined inline as well.
const ref = markNotificationDeliveryFailedByIdRef({ id: ..., attemptCount: ..., lastAttemptedAt: ..., provider: ..., lastErrorCode: ..., lastErrorMessage: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markNotificationDeliveryFailedByIdRef(dataConnect, markNotificationDeliveryFailedByIdVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.notificationDelivery_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.notificationDelivery_update);
});
```

## MarkTicketOrderPaidFromWebhook
You can execute the `MarkTicketOrderPaidFromWebhook` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markTicketOrderPaidFromWebhook(vars: MarkTicketOrderPaidFromWebhookVariables): MutationPromise<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;

interface MarkTicketOrderPaidFromWebhookRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkTicketOrderPaidFromWebhookVariables): MutationRef<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;
}
export const markTicketOrderPaidFromWebhookRef: MarkTicketOrderPaidFromWebhookRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markTicketOrderPaidFromWebhook(dc: DataConnect, vars: MarkTicketOrderPaidFromWebhookVariables): MutationPromise<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;

interface MarkTicketOrderPaidFromWebhookRef {
  ...
  (dc: DataConnect, vars: MarkTicketOrderPaidFromWebhookVariables): MutationRef<MarkTicketOrderPaidFromWebhookData, MarkTicketOrderPaidFromWebhookVariables>;
}
export const markTicketOrderPaidFromWebhookRef: MarkTicketOrderPaidFromWebhookRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markTicketOrderPaidFromWebhookRef:
```typescript
const name = markTicketOrderPaidFromWebhookRef.operationName;
console.log(name);
```

### Variables
The `MarkTicketOrderPaidFromWebhook` mutation requires an argument of type `MarkTicketOrderPaidFromWebhookVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkTicketOrderPaidFromWebhookVariables {
  id: UUIDString;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  webhookEventId?: string | null;
}
```
### Return Type
Recall that executing the `MarkTicketOrderPaidFromWebhook` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkTicketOrderPaidFromWebhookData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkTicketOrderPaidFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}
```
### Using `MarkTicketOrderPaidFromWebhook`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markTicketOrderPaidFromWebhook, MarkTicketOrderPaidFromWebhookVariables } from '@dataconnect/generated';

// The `MarkTicketOrderPaidFromWebhook` mutation requires an argument of type `MarkTicketOrderPaidFromWebhookVariables`:
const markTicketOrderPaidFromWebhookVars: MarkTicketOrderPaidFromWebhookVariables = {
  id: ..., 
  stripeCheckoutSessionId: ..., // optional
  stripePaymentIntentId: ..., // optional
  webhookEventId: ..., // optional
};

// Call the `markTicketOrderPaidFromWebhook()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markTicketOrderPaidFromWebhook(markTicketOrderPaidFromWebhookVars);
// Variables can be defined inline as well.
const { data } = await markTicketOrderPaidFromWebhook({ id: ..., stripeCheckoutSessionId: ..., stripePaymentIntentId: ..., webhookEventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markTicketOrderPaidFromWebhook(dataConnect, markTicketOrderPaidFromWebhookVars);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
markTicketOrderPaidFromWebhook(markTicketOrderPaidFromWebhookVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

### Using `MarkTicketOrderPaidFromWebhook`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markTicketOrderPaidFromWebhookRef, MarkTicketOrderPaidFromWebhookVariables } from '@dataconnect/generated';

// The `MarkTicketOrderPaidFromWebhook` mutation requires an argument of type `MarkTicketOrderPaidFromWebhookVariables`:
const markTicketOrderPaidFromWebhookVars: MarkTicketOrderPaidFromWebhookVariables = {
  id: ..., 
  stripeCheckoutSessionId: ..., // optional
  stripePaymentIntentId: ..., // optional
  webhookEventId: ..., // optional
};

// Call the `markTicketOrderPaidFromWebhookRef()` function to get a reference to the mutation.
const ref = markTicketOrderPaidFromWebhookRef(markTicketOrderPaidFromWebhookVars);
// Variables can be defined inline as well.
const ref = markTicketOrderPaidFromWebhookRef({ id: ..., stripeCheckoutSessionId: ..., stripePaymentIntentId: ..., webhookEventId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markTicketOrderPaidFromWebhookRef(dataConnect, markTicketOrderPaidFromWebhookVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

## MarkTicketOrderFailedFromWebhook
You can execute the `MarkTicketOrderFailedFromWebhook` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markTicketOrderFailedFromWebhook(vars: MarkTicketOrderFailedFromWebhookVariables): MutationPromise<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;

interface MarkTicketOrderFailedFromWebhookRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkTicketOrderFailedFromWebhookVariables): MutationRef<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;
}
export const markTicketOrderFailedFromWebhookRef: MarkTicketOrderFailedFromWebhookRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markTicketOrderFailedFromWebhook(dc: DataConnect, vars: MarkTicketOrderFailedFromWebhookVariables): MutationPromise<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;

interface MarkTicketOrderFailedFromWebhookRef {
  ...
  (dc: DataConnect, vars: MarkTicketOrderFailedFromWebhookVariables): MutationRef<MarkTicketOrderFailedFromWebhookData, MarkTicketOrderFailedFromWebhookVariables>;
}
export const markTicketOrderFailedFromWebhookRef: MarkTicketOrderFailedFromWebhookRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markTicketOrderFailedFromWebhookRef:
```typescript
const name = markTicketOrderFailedFromWebhookRef.operationName;
console.log(name);
```

### Variables
The `MarkTicketOrderFailedFromWebhook` mutation requires an argument of type `MarkTicketOrderFailedFromWebhookVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkTicketOrderFailedFromWebhookVariables {
  id: UUIDString;
  webhookEventId?: string | null;
}
```
### Return Type
Recall that executing the `MarkTicketOrderFailedFromWebhook` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkTicketOrderFailedFromWebhookData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkTicketOrderFailedFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}
```
### Using `MarkTicketOrderFailedFromWebhook`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markTicketOrderFailedFromWebhook, MarkTicketOrderFailedFromWebhookVariables } from '@dataconnect/generated';

// The `MarkTicketOrderFailedFromWebhook` mutation requires an argument of type `MarkTicketOrderFailedFromWebhookVariables`:
const markTicketOrderFailedFromWebhookVars: MarkTicketOrderFailedFromWebhookVariables = {
  id: ..., 
  webhookEventId: ..., // optional
};

// Call the `markTicketOrderFailedFromWebhook()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markTicketOrderFailedFromWebhook(markTicketOrderFailedFromWebhookVars);
// Variables can be defined inline as well.
const { data } = await markTicketOrderFailedFromWebhook({ id: ..., webhookEventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markTicketOrderFailedFromWebhook(dataConnect, markTicketOrderFailedFromWebhookVars);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
markTicketOrderFailedFromWebhook(markTicketOrderFailedFromWebhookVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

### Using `MarkTicketOrderFailedFromWebhook`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markTicketOrderFailedFromWebhookRef, MarkTicketOrderFailedFromWebhookVariables } from '@dataconnect/generated';

// The `MarkTicketOrderFailedFromWebhook` mutation requires an argument of type `MarkTicketOrderFailedFromWebhookVariables`:
const markTicketOrderFailedFromWebhookVars: MarkTicketOrderFailedFromWebhookVariables = {
  id: ..., 
  webhookEventId: ..., // optional
};

// Call the `markTicketOrderFailedFromWebhookRef()` function to get a reference to the mutation.
const ref = markTicketOrderFailedFromWebhookRef(markTicketOrderFailedFromWebhookVars);
// Variables can be defined inline as well.
const ref = markTicketOrderFailedFromWebhookRef({ id: ..., webhookEventId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markTicketOrderFailedFromWebhookRef(dataConnect, markTicketOrderFailedFromWebhookVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

## MarkTicketOrderRefundedFromWebhook
You can execute the `MarkTicketOrderRefundedFromWebhook` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markTicketOrderRefundedFromWebhook(vars: MarkTicketOrderRefundedFromWebhookVariables): MutationPromise<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;

interface MarkTicketOrderRefundedFromWebhookRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkTicketOrderRefundedFromWebhookVariables): MutationRef<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;
}
export const markTicketOrderRefundedFromWebhookRef: MarkTicketOrderRefundedFromWebhookRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markTicketOrderRefundedFromWebhook(dc: DataConnect, vars: MarkTicketOrderRefundedFromWebhookVariables): MutationPromise<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;

interface MarkTicketOrderRefundedFromWebhookRef {
  ...
  (dc: DataConnect, vars: MarkTicketOrderRefundedFromWebhookVariables): MutationRef<MarkTicketOrderRefundedFromWebhookData, MarkTicketOrderRefundedFromWebhookVariables>;
}
export const markTicketOrderRefundedFromWebhookRef: MarkTicketOrderRefundedFromWebhookRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markTicketOrderRefundedFromWebhookRef:
```typescript
const name = markTicketOrderRefundedFromWebhookRef.operationName;
console.log(name);
```

### Variables
The `MarkTicketOrderRefundedFromWebhook` mutation requires an argument of type `MarkTicketOrderRefundedFromWebhookVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkTicketOrderRefundedFromWebhookVariables {
  id: UUIDString;
  webhookEventId?: string | null;
  stripeRefundId?: string | null;
  refundedAmountMinor?: number | null;
  refundedAt?: TimestampString | null;
}
```
### Return Type
Recall that executing the `MarkTicketOrderRefundedFromWebhook` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkTicketOrderRefundedFromWebhookData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkTicketOrderRefundedFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}
```
### Using `MarkTicketOrderRefundedFromWebhook`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markTicketOrderRefundedFromWebhook, MarkTicketOrderRefundedFromWebhookVariables } from '@dataconnect/generated';

// The `MarkTicketOrderRefundedFromWebhook` mutation requires an argument of type `MarkTicketOrderRefundedFromWebhookVariables`:
const markTicketOrderRefundedFromWebhookVars: MarkTicketOrderRefundedFromWebhookVariables = {
  id: ..., 
  webhookEventId: ..., // optional
  stripeRefundId: ..., // optional
  refundedAmountMinor: ..., // optional
  refundedAt: ..., // optional
};

// Call the `markTicketOrderRefundedFromWebhook()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markTicketOrderRefundedFromWebhook(markTicketOrderRefundedFromWebhookVars);
// Variables can be defined inline as well.
const { data } = await markTicketOrderRefundedFromWebhook({ id: ..., webhookEventId: ..., stripeRefundId: ..., refundedAmountMinor: ..., refundedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markTicketOrderRefundedFromWebhook(dataConnect, markTicketOrderRefundedFromWebhookVars);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
markTicketOrderRefundedFromWebhook(markTicketOrderRefundedFromWebhookVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

### Using `MarkTicketOrderRefundedFromWebhook`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markTicketOrderRefundedFromWebhookRef, MarkTicketOrderRefundedFromWebhookVariables } from '@dataconnect/generated';

// The `MarkTicketOrderRefundedFromWebhook` mutation requires an argument of type `MarkTicketOrderRefundedFromWebhookVariables`:
const markTicketOrderRefundedFromWebhookVars: MarkTicketOrderRefundedFromWebhookVariables = {
  id: ..., 
  webhookEventId: ..., // optional
  stripeRefundId: ..., // optional
  refundedAmountMinor: ..., // optional
  refundedAt: ..., // optional
};

// Call the `markTicketOrderRefundedFromWebhookRef()` function to get a reference to the mutation.
const ref = markTicketOrderRefundedFromWebhookRef(markTicketOrderRefundedFromWebhookVars);
// Variables can be defined inline as well.
const ref = markTicketOrderRefundedFromWebhookRef({ id: ..., webhookEventId: ..., stripeRefundId: ..., refundedAmountMinor: ..., refundedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markTicketOrderRefundedFromWebhookRef(dataConnect, markTicketOrderRefundedFromWebhookVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

## UpsertTicketOrderDisputeFromWebhook
You can execute the `UpsertTicketOrderDisputeFromWebhook` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertTicketOrderDisputeFromWebhook(vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationPromise<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;

interface UpsertTicketOrderDisputeFromWebhookRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationRef<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;
}
export const upsertTicketOrderDisputeFromWebhookRef: UpsertTicketOrderDisputeFromWebhookRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertTicketOrderDisputeFromWebhook(dc: DataConnect, vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationPromise<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;

interface UpsertTicketOrderDisputeFromWebhookRef {
  ...
  (dc: DataConnect, vars: UpsertTicketOrderDisputeFromWebhookVariables): MutationRef<UpsertTicketOrderDisputeFromWebhookData, UpsertTicketOrderDisputeFromWebhookVariables>;
}
export const upsertTicketOrderDisputeFromWebhookRef: UpsertTicketOrderDisputeFromWebhookRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertTicketOrderDisputeFromWebhookRef:
```typescript
const name = upsertTicketOrderDisputeFromWebhookRef.operationName;
console.log(name);
```

### Variables
The `UpsertTicketOrderDisputeFromWebhook` mutation requires an argument of type `UpsertTicketOrderDisputeFromWebhookVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertTicketOrderDisputeFromWebhookVariables {
  id: UUIDString;
  webhookEventId?: string | null;
  stripeDisputeId?: string | null;
  disputeStatus?: string | null;
  disputeReason?: string | null;
  disputeAmountMinor?: number | null;
  disputeOpenedAt?: TimestampString | null;
  disputeUpdatedAt?: TimestampString | null;
  disputeClosedAt?: TimestampString | null;
}
```
### Return Type
Recall that executing the `UpsertTicketOrderDisputeFromWebhook` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertTicketOrderDisputeFromWebhookData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertTicketOrderDisputeFromWebhookData {
  ticketOrder_update?: TicketOrder_Key | null;
}
```
### Using `UpsertTicketOrderDisputeFromWebhook`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertTicketOrderDisputeFromWebhook, UpsertTicketOrderDisputeFromWebhookVariables } from '@dataconnect/generated';

// The `UpsertTicketOrderDisputeFromWebhook` mutation requires an argument of type `UpsertTicketOrderDisputeFromWebhookVariables`:
const upsertTicketOrderDisputeFromWebhookVars: UpsertTicketOrderDisputeFromWebhookVariables = {
  id: ..., 
  webhookEventId: ..., // optional
  stripeDisputeId: ..., // optional
  disputeStatus: ..., // optional
  disputeReason: ..., // optional
  disputeAmountMinor: ..., // optional
  disputeOpenedAt: ..., // optional
  disputeUpdatedAt: ..., // optional
  disputeClosedAt: ..., // optional
};

// Call the `upsertTicketOrderDisputeFromWebhook()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertTicketOrderDisputeFromWebhook(upsertTicketOrderDisputeFromWebhookVars);
// Variables can be defined inline as well.
const { data } = await upsertTicketOrderDisputeFromWebhook({ id: ..., webhookEventId: ..., stripeDisputeId: ..., disputeStatus: ..., disputeReason: ..., disputeAmountMinor: ..., disputeOpenedAt: ..., disputeUpdatedAt: ..., disputeClosedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertTicketOrderDisputeFromWebhook(dataConnect, upsertTicketOrderDisputeFromWebhookVars);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
upsertTicketOrderDisputeFromWebhook(upsertTicketOrderDisputeFromWebhookVars).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

### Using `UpsertTicketOrderDisputeFromWebhook`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertTicketOrderDisputeFromWebhookRef, UpsertTicketOrderDisputeFromWebhookVariables } from '@dataconnect/generated';

// The `UpsertTicketOrderDisputeFromWebhook` mutation requires an argument of type `UpsertTicketOrderDisputeFromWebhookVariables`:
const upsertTicketOrderDisputeFromWebhookVars: UpsertTicketOrderDisputeFromWebhookVariables = {
  id: ..., 
  webhookEventId: ..., // optional
  stripeDisputeId: ..., // optional
  disputeStatus: ..., // optional
  disputeReason: ..., // optional
  disputeAmountMinor: ..., // optional
  disputeOpenedAt: ..., // optional
  disputeUpdatedAt: ..., // optional
  disputeClosedAt: ..., // optional
};

// Call the `upsertTicketOrderDisputeFromWebhookRef()` function to get a reference to the mutation.
const ref = upsertTicketOrderDisputeFromWebhookRef(upsertTicketOrderDisputeFromWebhookVars);
// Variables can be defined inline as well.
const ref = upsertTicketOrderDisputeFromWebhookRef({ id: ..., webhookEventId: ..., stripeDisputeId: ..., disputeStatus: ..., disputeReason: ..., disputeAmountMinor: ..., disputeOpenedAt: ..., disputeUpdatedAt: ..., disputeClosedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertTicketOrderDisputeFromWebhookRef(dataConnect, upsertTicketOrderDisputeFromWebhookVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ticketOrder_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ticketOrder_update);
});
```

## CreatePaymentReconciliationException
You can execute the `CreatePaymentReconciliationException` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPaymentReconciliationException(vars: CreatePaymentReconciliationExceptionVariables): MutationPromise<CreatePaymentReconciliationExceptionData, CreatePaymentReconciliationExceptionVariables>;

interface CreatePaymentReconciliationExceptionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePaymentReconciliationExceptionVariables): MutationRef<CreatePaymentReconciliationExceptionData, CreatePaymentReconciliationExceptionVariables>;
}
export const createPaymentReconciliationExceptionRef: CreatePaymentReconciliationExceptionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPaymentReconciliationException(dc: DataConnect, vars: CreatePaymentReconciliationExceptionVariables): MutationPromise<CreatePaymentReconciliationExceptionData, CreatePaymentReconciliationExceptionVariables>;

interface CreatePaymentReconciliationExceptionRef {
  ...
  (dc: DataConnect, vars: CreatePaymentReconciliationExceptionVariables): MutationRef<CreatePaymentReconciliationExceptionData, CreatePaymentReconciliationExceptionVariables>;
}
export const createPaymentReconciliationExceptionRef: CreatePaymentReconciliationExceptionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPaymentReconciliationExceptionRef:
```typescript
const name = createPaymentReconciliationExceptionRef.operationName;
console.log(name);
```

### Variables
The `CreatePaymentReconciliationException` mutation requires an argument of type `CreatePaymentReconciliationExceptionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreatePaymentReconciliationExceptionVariables {
  ticketOrderId: UUIDString;
  exceptionType: PaymentReconciliationExceptionType;
  status: PaymentReconciliationExceptionStatus;
  note?: string | null;
  ownerUserId?: string | null;
  lastAttemptedAt?: TimestampString | null;
  resolvedAt?: TimestampString | null;
}
```
### Return Type
Recall that executing the `CreatePaymentReconciliationException` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePaymentReconciliationExceptionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePaymentReconciliationExceptionData {
  paymentReconciliationException_insert: PaymentReconciliationException_Key;
}
```
### Using `CreatePaymentReconciliationException`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPaymentReconciliationException, CreatePaymentReconciliationExceptionVariables } from '@dataconnect/generated';

// The `CreatePaymentReconciliationException` mutation requires an argument of type `CreatePaymentReconciliationExceptionVariables`:
const createPaymentReconciliationExceptionVars: CreatePaymentReconciliationExceptionVariables = {
  ticketOrderId: ..., 
  exceptionType: ..., 
  status: ..., 
  note: ..., // optional
  ownerUserId: ..., // optional
  lastAttemptedAt: ..., // optional
  resolvedAt: ..., // optional
};

// Call the `createPaymentReconciliationException()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPaymentReconciliationException(createPaymentReconciliationExceptionVars);
// Variables can be defined inline as well.
const { data } = await createPaymentReconciliationException({ ticketOrderId: ..., exceptionType: ..., status: ..., note: ..., ownerUserId: ..., lastAttemptedAt: ..., resolvedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPaymentReconciliationException(dataConnect, createPaymentReconciliationExceptionVars);

console.log(data.paymentReconciliationException_insert);

// Or, you can use the `Promise` API.
createPaymentReconciliationException(createPaymentReconciliationExceptionVars).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationException_insert);
});
```

### Using `CreatePaymentReconciliationException`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPaymentReconciliationExceptionRef, CreatePaymentReconciliationExceptionVariables } from '@dataconnect/generated';

// The `CreatePaymentReconciliationException` mutation requires an argument of type `CreatePaymentReconciliationExceptionVariables`:
const createPaymentReconciliationExceptionVars: CreatePaymentReconciliationExceptionVariables = {
  ticketOrderId: ..., 
  exceptionType: ..., 
  status: ..., 
  note: ..., // optional
  ownerUserId: ..., // optional
  lastAttemptedAt: ..., // optional
  resolvedAt: ..., // optional
};

// Call the `createPaymentReconciliationExceptionRef()` function to get a reference to the mutation.
const ref = createPaymentReconciliationExceptionRef(createPaymentReconciliationExceptionVars);
// Variables can be defined inline as well.
const ref = createPaymentReconciliationExceptionRef({ ticketOrderId: ..., exceptionType: ..., status: ..., note: ..., ownerUserId: ..., lastAttemptedAt: ..., resolvedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPaymentReconciliationExceptionRef(dataConnect, createPaymentReconciliationExceptionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.paymentReconciliationException_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationException_insert);
});
```

## UpdatePaymentReconciliationExceptionById
You can execute the `UpdatePaymentReconciliationExceptionById` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updatePaymentReconciliationExceptionById(vars: UpdatePaymentReconciliationExceptionByIdVariables): MutationPromise<UpdatePaymentReconciliationExceptionByIdData, UpdatePaymentReconciliationExceptionByIdVariables>;

interface UpdatePaymentReconciliationExceptionByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdatePaymentReconciliationExceptionByIdVariables): MutationRef<UpdatePaymentReconciliationExceptionByIdData, UpdatePaymentReconciliationExceptionByIdVariables>;
}
export const updatePaymentReconciliationExceptionByIdRef: UpdatePaymentReconciliationExceptionByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updatePaymentReconciliationExceptionById(dc: DataConnect, vars: UpdatePaymentReconciliationExceptionByIdVariables): MutationPromise<UpdatePaymentReconciliationExceptionByIdData, UpdatePaymentReconciliationExceptionByIdVariables>;

interface UpdatePaymentReconciliationExceptionByIdRef {
  ...
  (dc: DataConnect, vars: UpdatePaymentReconciliationExceptionByIdVariables): MutationRef<UpdatePaymentReconciliationExceptionByIdData, UpdatePaymentReconciliationExceptionByIdVariables>;
}
export const updatePaymentReconciliationExceptionByIdRef: UpdatePaymentReconciliationExceptionByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updatePaymentReconciliationExceptionByIdRef:
```typescript
const name = updatePaymentReconciliationExceptionByIdRef.operationName;
console.log(name);
```

### Variables
The `UpdatePaymentReconciliationExceptionById` mutation requires an argument of type `UpdatePaymentReconciliationExceptionByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdatePaymentReconciliationExceptionByIdVariables {
  id: UUIDString;
  status: PaymentReconciliationExceptionStatus;
  note?: string | null;
  ownerUserId?: string | null;
  lastAttemptedAt?: TimestampString | null;
  resolvedAt?: TimestampString | null;
}
```
### Return Type
Recall that executing the `UpdatePaymentReconciliationExceptionById` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdatePaymentReconciliationExceptionByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdatePaymentReconciliationExceptionByIdData {
  paymentReconciliationException_update?: PaymentReconciliationException_Key | null;
}
```
### Using `UpdatePaymentReconciliationExceptionById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updatePaymentReconciliationExceptionById, UpdatePaymentReconciliationExceptionByIdVariables } from '@dataconnect/generated';

// The `UpdatePaymentReconciliationExceptionById` mutation requires an argument of type `UpdatePaymentReconciliationExceptionByIdVariables`:
const updatePaymentReconciliationExceptionByIdVars: UpdatePaymentReconciliationExceptionByIdVariables = {
  id: ..., 
  status: ..., 
  note: ..., // optional
  ownerUserId: ..., // optional
  lastAttemptedAt: ..., // optional
  resolvedAt: ..., // optional
};

// Call the `updatePaymentReconciliationExceptionById()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updatePaymentReconciliationExceptionById(updatePaymentReconciliationExceptionByIdVars);
// Variables can be defined inline as well.
const { data } = await updatePaymentReconciliationExceptionById({ id: ..., status: ..., note: ..., ownerUserId: ..., lastAttemptedAt: ..., resolvedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updatePaymentReconciliationExceptionById(dataConnect, updatePaymentReconciliationExceptionByIdVars);

console.log(data.paymentReconciliationException_update);

// Or, you can use the `Promise` API.
updatePaymentReconciliationExceptionById(updatePaymentReconciliationExceptionByIdVars).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationException_update);
});
```

### Using `UpdatePaymentReconciliationExceptionById`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updatePaymentReconciliationExceptionByIdRef, UpdatePaymentReconciliationExceptionByIdVariables } from '@dataconnect/generated';

// The `UpdatePaymentReconciliationExceptionById` mutation requires an argument of type `UpdatePaymentReconciliationExceptionByIdVariables`:
const updatePaymentReconciliationExceptionByIdVars: UpdatePaymentReconciliationExceptionByIdVariables = {
  id: ..., 
  status: ..., 
  note: ..., // optional
  ownerUserId: ..., // optional
  lastAttemptedAt: ..., // optional
  resolvedAt: ..., // optional
};

// Call the `updatePaymentReconciliationExceptionByIdRef()` function to get a reference to the mutation.
const ref = updatePaymentReconciliationExceptionByIdRef(updatePaymentReconciliationExceptionByIdVars);
// Variables can be defined inline as well.
const ref = updatePaymentReconciliationExceptionByIdRef({ id: ..., status: ..., note: ..., ownerUserId: ..., lastAttemptedAt: ..., resolvedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updatePaymentReconciliationExceptionByIdRef(dataConnect, updatePaymentReconciliationExceptionByIdVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.paymentReconciliationException_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationException_update);
});
```

## UpdateBookingPreferencesFromCallable
You can execute the `UpdateBookingPreferencesFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateBookingPreferencesFromCallable(vars: UpdateBookingPreferencesFromCallableVariables): MutationPromise<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;

interface UpdateBookingPreferencesFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingPreferencesFromCallableVariables): MutationRef<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;
}
export const updateBookingPreferencesFromCallableRef: UpdateBookingPreferencesFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateBookingPreferencesFromCallable(dc: DataConnect, vars: UpdateBookingPreferencesFromCallableVariables): MutationPromise<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;

interface UpdateBookingPreferencesFromCallableRef {
  ...
  (dc: DataConnect, vars: UpdateBookingPreferencesFromCallableVariables): MutationRef<UpdateBookingPreferencesFromCallableData, UpdateBookingPreferencesFromCallableVariables>;
}
export const updateBookingPreferencesFromCallableRef: UpdateBookingPreferencesFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateBookingPreferencesFromCallableRef:
```typescript
const name = updateBookingPreferencesFromCallableRef.operationName;
console.log(name);
```

### Variables
The `UpdateBookingPreferencesFromCallable` mutation requires an argument of type `UpdateBookingPreferencesFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateBookingPreferencesFromCallableVariables {
  id: UUIDString;
  bookerDietaryNote?: string | null;
  sitNextToUserIds?: string[] | null;
  accommodationRequested: boolean;
  accommodationNote?: string | null;
}
```
### Return Type
Recall that executing the `UpdateBookingPreferencesFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateBookingPreferencesFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateBookingPreferencesFromCallableData {
  booking_update?: Booking_Key | null;
}
```
### Using `UpdateBookingPreferencesFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateBookingPreferencesFromCallable, UpdateBookingPreferencesFromCallableVariables } from '@dataconnect/generated';

// The `UpdateBookingPreferencesFromCallable` mutation requires an argument of type `UpdateBookingPreferencesFromCallableVariables`:
const updateBookingPreferencesFromCallableVars: UpdateBookingPreferencesFromCallableVariables = {
  id: ..., 
  bookerDietaryNote: ..., // optional
  sitNextToUserIds: ..., // optional
  accommodationRequested: ..., 
  accommodationNote: ..., // optional
};

// Call the `updateBookingPreferencesFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateBookingPreferencesFromCallable(updateBookingPreferencesFromCallableVars);
// Variables can be defined inline as well.
const { data } = await updateBookingPreferencesFromCallable({ id: ..., bookerDietaryNote: ..., sitNextToUserIds: ..., accommodationRequested: ..., accommodationNote: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateBookingPreferencesFromCallable(dataConnect, updateBookingPreferencesFromCallableVars);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
updateBookingPreferencesFromCallable(updateBookingPreferencesFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

### Using `UpdateBookingPreferencesFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateBookingPreferencesFromCallableRef, UpdateBookingPreferencesFromCallableVariables } from '@dataconnect/generated';

// The `UpdateBookingPreferencesFromCallable` mutation requires an argument of type `UpdateBookingPreferencesFromCallableVariables`:
const updateBookingPreferencesFromCallableVars: UpdateBookingPreferencesFromCallableVariables = {
  id: ..., 
  bookerDietaryNote: ..., // optional
  sitNextToUserIds: ..., // optional
  accommodationRequested: ..., 
  accommodationNote: ..., // optional
};

// Call the `updateBookingPreferencesFromCallableRef()` function to get a reference to the mutation.
const ref = updateBookingPreferencesFromCallableRef(updateBookingPreferencesFromCallableVars);
// Variables can be defined inline as well.
const ref = updateBookingPreferencesFromCallableRef({ id: ..., bookerDietaryNote: ..., sitNextToUserIds: ..., accommodationRequested: ..., accommodationNote: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateBookingPreferencesFromCallableRef(dataConnect, updateBookingPreferencesFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

## DeleteBookingLineFromCallable
You can execute the `DeleteBookingLineFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteBookingLineFromCallable(vars: DeleteBookingLineFromCallableVariables): MutationPromise<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;

interface DeleteBookingLineFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteBookingLineFromCallableVariables): MutationRef<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;
}
export const deleteBookingLineFromCallableRef: DeleteBookingLineFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteBookingLineFromCallable(dc: DataConnect, vars: DeleteBookingLineFromCallableVariables): MutationPromise<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;

interface DeleteBookingLineFromCallableRef {
  ...
  (dc: DataConnect, vars: DeleteBookingLineFromCallableVariables): MutationRef<DeleteBookingLineFromCallableData, DeleteBookingLineFromCallableVariables>;
}
export const deleteBookingLineFromCallableRef: DeleteBookingLineFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteBookingLineFromCallableRef:
```typescript
const name = deleteBookingLineFromCallableRef.operationName;
console.log(name);
```

### Variables
The `DeleteBookingLineFromCallable` mutation requires an argument of type `DeleteBookingLineFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteBookingLineFromCallableVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteBookingLineFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteBookingLineFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteBookingLineFromCallableData {
  bookingLine_delete?: BookingLine_Key | null;
}
```
### Using `DeleteBookingLineFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteBookingLineFromCallable, DeleteBookingLineFromCallableVariables } from '@dataconnect/generated';

// The `DeleteBookingLineFromCallable` mutation requires an argument of type `DeleteBookingLineFromCallableVariables`:
const deleteBookingLineFromCallableVars: DeleteBookingLineFromCallableVariables = {
  id: ..., 
};

// Call the `deleteBookingLineFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteBookingLineFromCallable(deleteBookingLineFromCallableVars);
// Variables can be defined inline as well.
const { data } = await deleteBookingLineFromCallable({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteBookingLineFromCallable(dataConnect, deleteBookingLineFromCallableVars);

console.log(data.bookingLine_delete);

// Or, you can use the `Promise` API.
deleteBookingLineFromCallable(deleteBookingLineFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_delete);
});
```

### Using `DeleteBookingLineFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteBookingLineFromCallableRef, DeleteBookingLineFromCallableVariables } from '@dataconnect/generated';

// The `DeleteBookingLineFromCallable` mutation requires an argument of type `DeleteBookingLineFromCallableVariables`:
const deleteBookingLineFromCallableVars: DeleteBookingLineFromCallableVariables = {
  id: ..., 
};

// Call the `deleteBookingLineFromCallableRef()` function to get a reference to the mutation.
const ref = deleteBookingLineFromCallableRef(deleteBookingLineFromCallableVars);
// Variables can be defined inline as well.
const ref = deleteBookingLineFromCallableRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteBookingLineFromCallableRef(dataConnect, deleteBookingLineFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.bookingLine_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_delete);
});
```

## CreateGuestTicketRequestFromCallable
You can execute the `CreateGuestTicketRequestFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createGuestTicketRequestFromCallable(vars: CreateGuestTicketRequestFromCallableVariables): MutationPromise<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;

interface CreateGuestTicketRequestFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGuestTicketRequestFromCallableVariables): MutationRef<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;
}
export const createGuestTicketRequestFromCallableRef: CreateGuestTicketRequestFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createGuestTicketRequestFromCallable(dc: DataConnect, vars: CreateGuestTicketRequestFromCallableVariables): MutationPromise<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;

interface CreateGuestTicketRequestFromCallableRef {
  ...
  (dc: DataConnect, vars: CreateGuestTicketRequestFromCallableVariables): MutationRef<CreateGuestTicketRequestFromCallableData, CreateGuestTicketRequestFromCallableVariables>;
}
export const createGuestTicketRequestFromCallableRef: CreateGuestTicketRequestFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createGuestTicketRequestFromCallableRef:
```typescript
const name = createGuestTicketRequestFromCallableRef.operationName;
console.log(name);
```

### Variables
The `CreateGuestTicketRequestFromCallable` mutation requires an argument of type `CreateGuestTicketRequestFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateGuestTicketRequestFromCallableVariables {
  bookingId: UUIDString;
  requestedGuestCount: number;
  guestTicketTypeId: UUIDString;
  guestDisplayName: string;
  dietaryNote?: string | null;
  status: GuestTicketRequestStatus;
  reviewedById?: string | null;
  reviewedAt?: TimestampString | null;
  moderatorNote?: string | null;
}
```
### Return Type
Recall that executing the `CreateGuestTicketRequestFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateGuestTicketRequestFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateGuestTicketRequestFromCallableData {
  guestTicketRequest_insert: GuestTicketRequest_Key;
}
```
### Using `CreateGuestTicketRequestFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createGuestTicketRequestFromCallable, CreateGuestTicketRequestFromCallableVariables } from '@dataconnect/generated';

// The `CreateGuestTicketRequestFromCallable` mutation requires an argument of type `CreateGuestTicketRequestFromCallableVariables`:
const createGuestTicketRequestFromCallableVars: CreateGuestTicketRequestFromCallableVariables = {
  bookingId: ..., 
  requestedGuestCount: ..., 
  guestTicketTypeId: ..., 
  guestDisplayName: ..., 
  dietaryNote: ..., // optional
  status: ..., 
  reviewedById: ..., // optional
  reviewedAt: ..., // optional
  moderatorNote: ..., // optional
};

// Call the `createGuestTicketRequestFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createGuestTicketRequestFromCallable(createGuestTicketRequestFromCallableVars);
// Variables can be defined inline as well.
const { data } = await createGuestTicketRequestFromCallable({ bookingId: ..., requestedGuestCount: ..., guestTicketTypeId: ..., guestDisplayName: ..., dietaryNote: ..., status: ..., reviewedById: ..., reviewedAt: ..., moderatorNote: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createGuestTicketRequestFromCallable(dataConnect, createGuestTicketRequestFromCallableVars);

console.log(data.guestTicketRequest_insert);

// Or, you can use the `Promise` API.
createGuestTicketRequestFromCallable(createGuestTicketRequestFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_insert);
});
```

### Using `CreateGuestTicketRequestFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createGuestTicketRequestFromCallableRef, CreateGuestTicketRequestFromCallableVariables } from '@dataconnect/generated';

// The `CreateGuestTicketRequestFromCallable` mutation requires an argument of type `CreateGuestTicketRequestFromCallableVariables`:
const createGuestTicketRequestFromCallableVars: CreateGuestTicketRequestFromCallableVariables = {
  bookingId: ..., 
  requestedGuestCount: ..., 
  guestTicketTypeId: ..., 
  guestDisplayName: ..., 
  dietaryNote: ..., // optional
  status: ..., 
  reviewedById: ..., // optional
  reviewedAt: ..., // optional
  moderatorNote: ..., // optional
};

// Call the `createGuestTicketRequestFromCallableRef()` function to get a reference to the mutation.
const ref = createGuestTicketRequestFromCallableRef(createGuestTicketRequestFromCallableVars);
// Variables can be defined inline as well.
const ref = createGuestTicketRequestFromCallableRef({ bookingId: ..., requestedGuestCount: ..., guestTicketTypeId: ..., guestDisplayName: ..., dietaryNote: ..., status: ..., reviewedById: ..., reviewedAt: ..., moderatorNote: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createGuestTicketRequestFromCallableRef(dataConnect, createGuestTicketRequestFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.guestTicketRequest_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_insert);
});
```

## AdminReviewGuestTicketRequestFromCallable
You can execute the `AdminReviewGuestTicketRequestFromCallable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
adminReviewGuestTicketRequestFromCallable(vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationPromise<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;

interface AdminReviewGuestTicketRequestFromCallableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationRef<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;
}
export const adminReviewGuestTicketRequestFromCallableRef: AdminReviewGuestTicketRequestFromCallableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminReviewGuestTicketRequestFromCallable(dc: DataConnect, vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationPromise<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;

interface AdminReviewGuestTicketRequestFromCallableRef {
  ...
  (dc: DataConnect, vars: AdminReviewGuestTicketRequestFromCallableVariables): MutationRef<AdminReviewGuestTicketRequestFromCallableData, AdminReviewGuestTicketRequestFromCallableVariables>;
}
export const adminReviewGuestTicketRequestFromCallableRef: AdminReviewGuestTicketRequestFromCallableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminReviewGuestTicketRequestFromCallableRef:
```typescript
const name = adminReviewGuestTicketRequestFromCallableRef.operationName;
console.log(name);
```

### Variables
The `AdminReviewGuestTicketRequestFromCallable` mutation requires an argument of type `AdminReviewGuestTicketRequestFromCallableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminReviewGuestTicketRequestFromCallableVariables {
  id: UUIDString;
  status: GuestTicketRequestStatus;
  moderatorNote?: string | null;
  reviewedById: string;
}
```
### Return Type
Recall that executing the `AdminReviewGuestTicketRequestFromCallable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminReviewGuestTicketRequestFromCallableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminReviewGuestTicketRequestFromCallableData {
  guestTicketRequest_update?: GuestTicketRequest_Key | null;
}
```
### Using `AdminReviewGuestTicketRequestFromCallable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminReviewGuestTicketRequestFromCallable, AdminReviewGuestTicketRequestFromCallableVariables } from '@dataconnect/generated';

// The `AdminReviewGuestTicketRequestFromCallable` mutation requires an argument of type `AdminReviewGuestTicketRequestFromCallableVariables`:
const adminReviewGuestTicketRequestFromCallableVars: AdminReviewGuestTicketRequestFromCallableVariables = {
  id: ..., 
  status: ..., 
  moderatorNote: ..., // optional
  reviewedById: ..., 
};

// Call the `adminReviewGuestTicketRequestFromCallable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminReviewGuestTicketRequestFromCallable(adminReviewGuestTicketRequestFromCallableVars);
// Variables can be defined inline as well.
const { data } = await adminReviewGuestTicketRequestFromCallable({ id: ..., status: ..., moderatorNote: ..., reviewedById: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminReviewGuestTicketRequestFromCallable(dataConnect, adminReviewGuestTicketRequestFromCallableVars);

console.log(data.guestTicketRequest_update);

// Or, you can use the `Promise` API.
adminReviewGuestTicketRequestFromCallable(adminReviewGuestTicketRequestFromCallableVars).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_update);
});
```

### Using `AdminReviewGuestTicketRequestFromCallable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminReviewGuestTicketRequestFromCallableRef, AdminReviewGuestTicketRequestFromCallableVariables } from '@dataconnect/generated';

// The `AdminReviewGuestTicketRequestFromCallable` mutation requires an argument of type `AdminReviewGuestTicketRequestFromCallableVariables`:
const adminReviewGuestTicketRequestFromCallableVars: AdminReviewGuestTicketRequestFromCallableVariables = {
  id: ..., 
  status: ..., 
  moderatorNote: ..., // optional
  reviewedById: ..., 
};

// Call the `adminReviewGuestTicketRequestFromCallableRef()` function to get a reference to the mutation.
const ref = adminReviewGuestTicketRequestFromCallableRef(adminReviewGuestTicketRequestFromCallableVars);
// Variables can be defined inline as well.
const ref = adminReviewGuestTicketRequestFromCallableRef({ id: ..., status: ..., moderatorNote: ..., reviewedById: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminReviewGuestTicketRequestFromCallableRef(dataConnect, adminReviewGuestTicketRequestFromCallableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.guestTicketRequest_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_update);
});
```

## CreateAnnouncementSend
You can execute the `CreateAnnouncementSend` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAnnouncementSend(vars: CreateAnnouncementSendVariables): MutationPromise<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;

interface CreateAnnouncementSendRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAnnouncementSendVariables): MutationRef<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;
}
export const createAnnouncementSendRef: CreateAnnouncementSendRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAnnouncementSend(dc: DataConnect, vars: CreateAnnouncementSendVariables): MutationPromise<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;

interface CreateAnnouncementSendRef {
  ...
  (dc: DataConnect, vars: CreateAnnouncementSendVariables): MutationRef<CreateAnnouncementSendData, CreateAnnouncementSendVariables>;
}
export const createAnnouncementSendRef: CreateAnnouncementSendRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAnnouncementSendRef:
```typescript
const name = createAnnouncementSendRef.operationName;
console.log(name);
```

### Variables
The `CreateAnnouncementSend` mutation requires an argument of type `CreateAnnouncementSendVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAnnouncementSendVariables {
  id: UUIDString;
  sectionId: UUIDString;
  templateUuid: string;
  templateName?: string | null;
  sentBy: string;
  recipientCount: number;
  skippedCount: number;
  failureCount: number;
}
```
### Return Type
Recall that executing the `CreateAnnouncementSend` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAnnouncementSendData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAnnouncementSendData {
  announcementSend_insert: AnnouncementSend_Key;
}
```
### Using `CreateAnnouncementSend`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAnnouncementSend, CreateAnnouncementSendVariables } from '@dataconnect/generated';

// The `CreateAnnouncementSend` mutation requires an argument of type `CreateAnnouncementSendVariables`:
const createAnnouncementSendVars: CreateAnnouncementSendVariables = {
  id: ..., 
  sectionId: ..., 
  templateUuid: ..., 
  templateName: ..., // optional
  sentBy: ..., 
  recipientCount: ..., 
  skippedCount: ..., 
  failureCount: ..., 
};

// Call the `createAnnouncementSend()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAnnouncementSend(createAnnouncementSendVars);
// Variables can be defined inline as well.
const { data } = await createAnnouncementSend({ id: ..., sectionId: ..., templateUuid: ..., templateName: ..., sentBy: ..., recipientCount: ..., skippedCount: ..., failureCount: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAnnouncementSend(dataConnect, createAnnouncementSendVars);

console.log(data.announcementSend_insert);

// Or, you can use the `Promise` API.
createAnnouncementSend(createAnnouncementSendVars).then((response) => {
  const data = response.data;
  console.log(data.announcementSend_insert);
});
```

### Using `CreateAnnouncementSend`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAnnouncementSendRef, CreateAnnouncementSendVariables } from '@dataconnect/generated';

// The `CreateAnnouncementSend` mutation requires an argument of type `CreateAnnouncementSendVariables`:
const createAnnouncementSendVars: CreateAnnouncementSendVariables = {
  id: ..., 
  sectionId: ..., 
  templateUuid: ..., 
  templateName: ..., // optional
  sentBy: ..., 
  recipientCount: ..., 
  skippedCount: ..., 
  failureCount: ..., 
};

// Call the `createAnnouncementSendRef()` function to get a reference to the mutation.
const ref = createAnnouncementSendRef(createAnnouncementSendVars);
// Variables can be defined inline as well.
const ref = createAnnouncementSendRef({ id: ..., sectionId: ..., templateUuid: ..., templateName: ..., sentBy: ..., recipientCount: ..., skippedCount: ..., failureCount: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAnnouncementSendRef(dataConnect, createAnnouncementSendVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.announcementSend_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.announcementSend_insert);
});
```

## CreateAnnouncementRecipient
You can execute the `CreateAnnouncementRecipient` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAnnouncementRecipient(vars: CreateAnnouncementRecipientVariables): MutationPromise<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;

interface CreateAnnouncementRecipientRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAnnouncementRecipientVariables): MutationRef<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;
}
export const createAnnouncementRecipientRef: CreateAnnouncementRecipientRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAnnouncementRecipient(dc: DataConnect, vars: CreateAnnouncementRecipientVariables): MutationPromise<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;

interface CreateAnnouncementRecipientRef {
  ...
  (dc: DataConnect, vars: CreateAnnouncementRecipientVariables): MutationRef<CreateAnnouncementRecipientData, CreateAnnouncementRecipientVariables>;
}
export const createAnnouncementRecipientRef: CreateAnnouncementRecipientRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAnnouncementRecipientRef:
```typescript
const name = createAnnouncementRecipientRef.operationName;
console.log(name);
```

### Variables
The `CreateAnnouncementRecipient` mutation requires an argument of type `CreateAnnouncementRecipientVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAnnouncementRecipientVariables {
  announcementSendId: UUIDString;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  skippedReason?: string | null;
  sentAt?: TimestampString | null;
  failureReason?: string | null;
}
```
### Return Type
Recall that executing the `CreateAnnouncementRecipient` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAnnouncementRecipientData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAnnouncementRecipientData {
  announcementRecipient_insert: AnnouncementRecipient_Key;
}
```
### Using `CreateAnnouncementRecipient`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAnnouncementRecipient, CreateAnnouncementRecipientVariables } from '@dataconnect/generated';

// The `CreateAnnouncementRecipient` mutation requires an argument of type `CreateAnnouncementRecipientVariables`:
const createAnnouncementRecipientVars: CreateAnnouncementRecipientVariables = {
  announcementSendId: ..., 
  userId: ..., 
  email: ..., 
  firstName: ..., 
  lastName: ..., 
  status: ..., 
  skippedReason: ..., // optional
  sentAt: ..., // optional
  failureReason: ..., // optional
};

// Call the `createAnnouncementRecipient()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAnnouncementRecipient(createAnnouncementRecipientVars);
// Variables can be defined inline as well.
const { data } = await createAnnouncementRecipient({ announcementSendId: ..., userId: ..., email: ..., firstName: ..., lastName: ..., status: ..., skippedReason: ..., sentAt: ..., failureReason: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAnnouncementRecipient(dataConnect, createAnnouncementRecipientVars);

console.log(data.announcementRecipient_insert);

// Or, you can use the `Promise` API.
createAnnouncementRecipient(createAnnouncementRecipientVars).then((response) => {
  const data = response.data;
  console.log(data.announcementRecipient_insert);
});
```

### Using `CreateAnnouncementRecipient`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAnnouncementRecipientRef, CreateAnnouncementRecipientVariables } from '@dataconnect/generated';

// The `CreateAnnouncementRecipient` mutation requires an argument of type `CreateAnnouncementRecipientVariables`:
const createAnnouncementRecipientVars: CreateAnnouncementRecipientVariables = {
  announcementSendId: ..., 
  userId: ..., 
  email: ..., 
  firstName: ..., 
  lastName: ..., 
  status: ..., 
  skippedReason: ..., // optional
  sentAt: ..., // optional
  failureReason: ..., // optional
};

// Call the `createAnnouncementRecipientRef()` function to get a reference to the mutation.
const ref = createAnnouncementRecipientRef(createAnnouncementRecipientVars);
// Variables can be defined inline as well.
const ref = createAnnouncementRecipientRef({ announcementSendId: ..., userId: ..., email: ..., firstName: ..., lastName: ..., status: ..., skippedReason: ..., sentAt: ..., failureReason: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAnnouncementRecipientRef(dataConnect, createAnnouncementRecipientVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.announcementRecipient_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.announcementRecipient_insert);
});
```

## UpdateEmailBounceStats
You can execute the `UpdateEmailBounceStats` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateEmailBounceStats(vars: UpdateEmailBounceStatsVariables): MutationPromise<UpdateEmailBounceStatsData, UpdateEmailBounceStatsVariables>;

interface UpdateEmailBounceStatsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateEmailBounceStatsVariables): MutationRef<UpdateEmailBounceStatsData, UpdateEmailBounceStatsVariables>;
}
export const updateEmailBounceStatsRef: UpdateEmailBounceStatsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateEmailBounceStats(dc: DataConnect, vars: UpdateEmailBounceStatsVariables): MutationPromise<UpdateEmailBounceStatsData, UpdateEmailBounceStatsVariables>;

interface UpdateEmailBounceStatsRef {
  ...
  (dc: DataConnect, vars: UpdateEmailBounceStatsVariables): MutationRef<UpdateEmailBounceStatsData, UpdateEmailBounceStatsVariables>;
}
export const updateEmailBounceStatsRef: UpdateEmailBounceStatsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateEmailBounceStatsRef:
```typescript
const name = updateEmailBounceStatsRef.operationName;
console.log(name);
```

### Variables
The `UpdateEmailBounceStats` mutation requires an argument of type `UpdateEmailBounceStatsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateEmailBounceStatsVariables {
  userId: string;
  emailBounceCount: number;
  emailLastBounceAt?: TimestampString | null;
}
```
### Return Type
Recall that executing the `UpdateEmailBounceStats` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateEmailBounceStatsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateEmailBounceStatsData {
  user_update?: User_Key | null;
}
```
### Using `UpdateEmailBounceStats`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateEmailBounceStats, UpdateEmailBounceStatsVariables } from '@dataconnect/generated';

// The `UpdateEmailBounceStats` mutation requires an argument of type `UpdateEmailBounceStatsVariables`:
const updateEmailBounceStatsVars: UpdateEmailBounceStatsVariables = {
  userId: ..., 
  emailBounceCount: ..., 
  emailLastBounceAt: ..., // optional
};

// Call the `updateEmailBounceStats()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateEmailBounceStats(updateEmailBounceStatsVars);
// Variables can be defined inline as well.
const { data } = await updateEmailBounceStats({ userId: ..., emailBounceCount: ..., emailLastBounceAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateEmailBounceStats(dataConnect, updateEmailBounceStatsVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateEmailBounceStats(updateEmailBounceStatsVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateEmailBounceStats`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateEmailBounceStatsRef, UpdateEmailBounceStatsVariables } from '@dataconnect/generated';

// The `UpdateEmailBounceStats` mutation requires an argument of type `UpdateEmailBounceStatsVariables`:
const updateEmailBounceStatsVars: UpdateEmailBounceStatsVariables = {
  userId: ..., 
  emailBounceCount: ..., 
  emailLastBounceAt: ..., // optional
};

// Call the `updateEmailBounceStatsRef()` function to get a reference to the mutation.
const ref = updateEmailBounceStatsRef(updateEmailBounceStatsVars);
// Variables can be defined inline as well.
const ref = updateEmailBounceStatsRef({ userId: ..., emailBounceCount: ..., emailLastBounceAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateEmailBounceStatsRef(dataConnect, updateEmailBounceStatsVars);

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

## AdminOptOutSectionAnnouncement
You can execute the `AdminOptOutSectionAnnouncement` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
adminOptOutSectionAnnouncement(vars: AdminOptOutSectionAnnouncementVariables): MutationPromise<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;

interface AdminOptOutSectionAnnouncementRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminOptOutSectionAnnouncementVariables): MutationRef<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;
}
export const adminOptOutSectionAnnouncementRef: AdminOptOutSectionAnnouncementRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminOptOutSectionAnnouncement(dc: DataConnect, vars: AdminOptOutSectionAnnouncementVariables): MutationPromise<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;

interface AdminOptOutSectionAnnouncementRef {
  ...
  (dc: DataConnect, vars: AdminOptOutSectionAnnouncementVariables): MutationRef<AdminOptOutSectionAnnouncementData, AdminOptOutSectionAnnouncementVariables>;
}
export const adminOptOutSectionAnnouncementRef: AdminOptOutSectionAnnouncementRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminOptOutSectionAnnouncementRef:
```typescript
const name = adminOptOutSectionAnnouncementRef.operationName;
console.log(name);
```

### Variables
The `AdminOptOutSectionAnnouncement` mutation requires an argument of type `AdminOptOutSectionAnnouncementVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminOptOutSectionAnnouncementVariables {
  userId: string;
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `AdminOptOutSectionAnnouncement` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminOptOutSectionAnnouncementData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminOptOutSectionAnnouncementData {
  sectionAnnouncementOptOut_upsert: SectionAnnouncementOptOut_Key;
}
```
### Using `AdminOptOutSectionAnnouncement`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminOptOutSectionAnnouncement, AdminOptOutSectionAnnouncementVariables } from '@dataconnect/generated';

// The `AdminOptOutSectionAnnouncement` mutation requires an argument of type `AdminOptOutSectionAnnouncementVariables`:
const adminOptOutSectionAnnouncementVars: AdminOptOutSectionAnnouncementVariables = {
  userId: ..., 
  sectionId: ..., 
};

// Call the `adminOptOutSectionAnnouncement()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminOptOutSectionAnnouncement(adminOptOutSectionAnnouncementVars);
// Variables can be defined inline as well.
const { data } = await adminOptOutSectionAnnouncement({ userId: ..., sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminOptOutSectionAnnouncement(dataConnect, adminOptOutSectionAnnouncementVars);

console.log(data.sectionAnnouncementOptOut_upsert);

// Or, you can use the `Promise` API.
adminOptOutSectionAnnouncement(adminOptOutSectionAnnouncementVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_upsert);
});
```

### Using `AdminOptOutSectionAnnouncement`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminOptOutSectionAnnouncementRef, AdminOptOutSectionAnnouncementVariables } from '@dataconnect/generated';

// The `AdminOptOutSectionAnnouncement` mutation requires an argument of type `AdminOptOutSectionAnnouncementVariables`:
const adminOptOutSectionAnnouncementVars: AdminOptOutSectionAnnouncementVariables = {
  userId: ..., 
  sectionId: ..., 
};

// Call the `adminOptOutSectionAnnouncementRef()` function to get a reference to the mutation.
const ref = adminOptOutSectionAnnouncementRef(adminOptOutSectionAnnouncementVars);
// Variables can be defined inline as well.
const ref = adminOptOutSectionAnnouncementRef({ userId: ..., sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminOptOutSectionAnnouncementRef(dataConnect, adminOptOutSectionAnnouncementVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionAnnouncementOptOut_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_upsert);
});
```

## AdminOptInSectionAnnouncement
You can execute the `AdminOptInSectionAnnouncement` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
adminOptInSectionAnnouncement(vars: AdminOptInSectionAnnouncementVariables): MutationPromise<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;

interface AdminOptInSectionAnnouncementRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminOptInSectionAnnouncementVariables): MutationRef<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;
}
export const adminOptInSectionAnnouncementRef: AdminOptInSectionAnnouncementRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminOptInSectionAnnouncement(dc: DataConnect, vars: AdminOptInSectionAnnouncementVariables): MutationPromise<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;

interface AdminOptInSectionAnnouncementRef {
  ...
  (dc: DataConnect, vars: AdminOptInSectionAnnouncementVariables): MutationRef<AdminOptInSectionAnnouncementData, AdminOptInSectionAnnouncementVariables>;
}
export const adminOptInSectionAnnouncementRef: AdminOptInSectionAnnouncementRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminOptInSectionAnnouncementRef:
```typescript
const name = adminOptInSectionAnnouncementRef.operationName;
console.log(name);
```

### Variables
The `AdminOptInSectionAnnouncement` mutation requires an argument of type `AdminOptInSectionAnnouncementVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminOptInSectionAnnouncementVariables {
  userId: string;
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `AdminOptInSectionAnnouncement` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminOptInSectionAnnouncementData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminOptInSectionAnnouncementData {
  sectionAnnouncementOptOut_delete?: SectionAnnouncementOptOut_Key | null;
}
```
### Using `AdminOptInSectionAnnouncement`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminOptInSectionAnnouncement, AdminOptInSectionAnnouncementVariables } from '@dataconnect/generated';

// The `AdminOptInSectionAnnouncement` mutation requires an argument of type `AdminOptInSectionAnnouncementVariables`:
const adminOptInSectionAnnouncementVars: AdminOptInSectionAnnouncementVariables = {
  userId: ..., 
  sectionId: ..., 
};

// Call the `adminOptInSectionAnnouncement()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminOptInSectionAnnouncement(adminOptInSectionAnnouncementVars);
// Variables can be defined inline as well.
const { data } = await adminOptInSectionAnnouncement({ userId: ..., sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminOptInSectionAnnouncement(dataConnect, adminOptInSectionAnnouncementVars);

console.log(data.sectionAnnouncementOptOut_delete);

// Or, you can use the `Promise` API.
adminOptInSectionAnnouncement(adminOptInSectionAnnouncementVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_delete);
});
```

### Using `AdminOptInSectionAnnouncement`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminOptInSectionAnnouncementRef, AdminOptInSectionAnnouncementVariables } from '@dataconnect/generated';

// The `AdminOptInSectionAnnouncement` mutation requires an argument of type `AdminOptInSectionAnnouncementVariables`:
const adminOptInSectionAnnouncementVars: AdminOptInSectionAnnouncementVariables = {
  userId: ..., 
  sectionId: ..., 
};

// Call the `adminOptInSectionAnnouncementRef()` function to get a reference to the mutation.
const ref = adminOptInSectionAnnouncementRef(adminOptInSectionAnnouncementVars);
// Variables can be defined inline as well.
const ref = adminOptInSectionAnnouncementRef({ userId: ..., sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminOptInSectionAnnouncementRef(dataConnect, adminOptInSectionAnnouncementVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionAnnouncementOptOut_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_delete);
});
```

## UpsertCallableInvocation
You can execute the `UpsertCallableInvocation` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertCallableInvocation(vars: UpsertCallableInvocationVariables): MutationPromise<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;

interface UpsertCallableInvocationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertCallableInvocationVariables): MutationRef<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;
}
export const upsertCallableInvocationRef: UpsertCallableInvocationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertCallableInvocation(dc: DataConnect, vars: UpsertCallableInvocationVariables): MutationPromise<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;

interface UpsertCallableInvocationRef {
  ...
  (dc: DataConnect, vars: UpsertCallableInvocationVariables): MutationRef<UpsertCallableInvocationData, UpsertCallableInvocationVariables>;
}
export const upsertCallableInvocationRef: UpsertCallableInvocationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertCallableInvocationRef:
```typescript
const name = upsertCallableInvocationRef.operationName;
console.log(name);
```

### Variables
The `UpsertCallableInvocation` mutation requires an argument of type `UpsertCallableInvocationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertCallableInvocationVariables {
  userId: string;
  functionName: string;
  windowStart: TimestampString;
  count: number;
}
```
### Return Type
Recall that executing the `UpsertCallableInvocation` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertCallableInvocationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertCallableInvocationData {
  callableInvocation_upsert: CallableInvocation_Key;
}
```
### Using `UpsertCallableInvocation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertCallableInvocation, UpsertCallableInvocationVariables } from '@dataconnect/generated';

// The `UpsertCallableInvocation` mutation requires an argument of type `UpsertCallableInvocationVariables`:
const upsertCallableInvocationVars: UpsertCallableInvocationVariables = {
  userId: ..., 
  functionName: ..., 
  windowStart: ..., 
  count: ..., 
};

// Call the `upsertCallableInvocation()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertCallableInvocation(upsertCallableInvocationVars);
// Variables can be defined inline as well.
const { data } = await upsertCallableInvocation({ userId: ..., functionName: ..., windowStart: ..., count: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertCallableInvocation(dataConnect, upsertCallableInvocationVars);

console.log(data.callableInvocation_upsert);

// Or, you can use the `Promise` API.
upsertCallableInvocation(upsertCallableInvocationVars).then((response) => {
  const data = response.data;
  console.log(data.callableInvocation_upsert);
});
```

### Using `UpsertCallableInvocation`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertCallableInvocationRef, UpsertCallableInvocationVariables } from '@dataconnect/generated';

// The `UpsertCallableInvocation` mutation requires an argument of type `UpsertCallableInvocationVariables`:
const upsertCallableInvocationVars: UpsertCallableInvocationVariables = {
  userId: ..., 
  functionName: ..., 
  windowStart: ..., 
  count: ..., 
};

// Call the `upsertCallableInvocationRef()` function to get a reference to the mutation.
const ref = upsertCallableInvocationRef(upsertCallableInvocationVars);
// Variables can be defined inline as well.
const ref = upsertCallableInvocationRef({ userId: ..., functionName: ..., windowStart: ..., count: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertCallableInvocationRef(dataConnect, upsertCallableInvocationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.callableInvocation_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.callableInvocation_upsert);
});
```

## CreateBookingDraft
You can execute the `CreateBookingDraft` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createBookingDraft(vars: CreateBookingDraftVariables): MutationPromise<CreateBookingDraftData, CreateBookingDraftVariables>;

interface CreateBookingDraftRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateBookingDraftVariables): MutationRef<CreateBookingDraftData, CreateBookingDraftVariables>;
}
export const createBookingDraftRef: CreateBookingDraftRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createBookingDraft(dc: DataConnect, vars: CreateBookingDraftVariables): MutationPromise<CreateBookingDraftData, CreateBookingDraftVariables>;

interface CreateBookingDraftRef {
  ...
  (dc: DataConnect, vars: CreateBookingDraftVariables): MutationRef<CreateBookingDraftData, CreateBookingDraftVariables>;
}
export const createBookingDraftRef: CreateBookingDraftRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createBookingDraftRef:
```typescript
const name = createBookingDraftRef.operationName;
console.log(name);
```

### Variables
The `CreateBookingDraft` mutation requires an argument of type `CreateBookingDraftVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateBookingDraftVariables {
  eventId: UUIDString;
}
```
### Return Type
Recall that executing the `CreateBookingDraft` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateBookingDraftData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateBookingDraftData {
  booking_insert: Booking_Key;
}
```
### Using `CreateBookingDraft`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createBookingDraft, CreateBookingDraftVariables } from '@dataconnect/generated';

// The `CreateBookingDraft` mutation requires an argument of type `CreateBookingDraftVariables`:
const createBookingDraftVars: CreateBookingDraftVariables = {
  eventId: ..., 
};

// Call the `createBookingDraft()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createBookingDraft(createBookingDraftVars);
// Variables can be defined inline as well.
const { data } = await createBookingDraft({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createBookingDraft(dataConnect, createBookingDraftVars);

console.log(data.booking_insert);

// Or, you can use the `Promise` API.
createBookingDraft(createBookingDraftVars).then((response) => {
  const data = response.data;
  console.log(data.booking_insert);
});
```

### Using `CreateBookingDraft`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createBookingDraftRef, CreateBookingDraftVariables } from '@dataconnect/generated';

// The `CreateBookingDraft` mutation requires an argument of type `CreateBookingDraftVariables`:
const createBookingDraftVars: CreateBookingDraftVariables = {
  eventId: ..., 
};

// Call the `createBookingDraftRef()` function to get a reference to the mutation.
const ref = createBookingDraftRef(createBookingDraftVars);
// Variables can be defined inline as well.
const ref = createBookingDraftRef({ eventId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createBookingDraftRef(dataConnect, createBookingDraftVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_insert);
});
```

## AddBookingLine
You can execute the `AddBookingLine` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addBookingLine(vars: AddBookingLineVariables): MutationPromise<AddBookingLineData, AddBookingLineVariables>;

interface AddBookingLineRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddBookingLineVariables): MutationRef<AddBookingLineData, AddBookingLineVariables>;
}
export const addBookingLineRef: AddBookingLineRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addBookingLine(dc: DataConnect, vars: AddBookingLineVariables): MutationPromise<AddBookingLineData, AddBookingLineVariables>;

interface AddBookingLineRef {
  ...
  (dc: DataConnect, vars: AddBookingLineVariables): MutationRef<AddBookingLineData, AddBookingLineVariables>;
}
export const addBookingLineRef: AddBookingLineRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addBookingLineRef:
```typescript
const name = addBookingLineRef.operationName;
console.log(name);
```

### Variables
The `AddBookingLine` mutation requires an argument of type `AddBookingLineVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddBookingLineVariables {
  bookingId: UUIDString;
  ticketTypeId: UUIDString;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
  sortOrder: number;
}
```
### Return Type
Recall that executing the `AddBookingLine` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddBookingLineData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddBookingLineData {
  bookingLine_insert: BookingLine_Key;
}
```
### Using `AddBookingLine`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addBookingLine, AddBookingLineVariables } from '@dataconnect/generated';

// The `AddBookingLine` mutation requires an argument of type `AddBookingLineVariables`:
const addBookingLineVars: AddBookingLineVariables = {
  bookingId: ..., 
  ticketTypeId: ..., 
  guestUserId: ..., // optional
  guestDisplayName: ..., // optional
  dietaryNote: ..., // optional
  sortOrder: ..., 
};

// Call the `addBookingLine()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addBookingLine(addBookingLineVars);
// Variables can be defined inline as well.
const { data } = await addBookingLine({ bookingId: ..., ticketTypeId: ..., guestUserId: ..., guestDisplayName: ..., dietaryNote: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addBookingLine(dataConnect, addBookingLineVars);

console.log(data.bookingLine_insert);

// Or, you can use the `Promise` API.
addBookingLine(addBookingLineVars).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_insert);
});
```

### Using `AddBookingLine`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addBookingLineRef, AddBookingLineVariables } from '@dataconnect/generated';

// The `AddBookingLine` mutation requires an argument of type `AddBookingLineVariables`:
const addBookingLineVars: AddBookingLineVariables = {
  bookingId: ..., 
  ticketTypeId: ..., 
  guestUserId: ..., // optional
  guestDisplayName: ..., // optional
  dietaryNote: ..., // optional
  sortOrder: ..., 
};

// Call the `addBookingLineRef()` function to get a reference to the mutation.
const ref = addBookingLineRef(addBookingLineVars);
// Variables can be defined inline as well.
const ref = addBookingLineRef({ bookingId: ..., ticketTypeId: ..., guestUserId: ..., guestDisplayName: ..., dietaryNote: ..., sortOrder: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addBookingLineRef(dataConnect, addBookingLineVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.bookingLine_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_insert);
});
```

## UpdateBookingStatus
You can execute the `UpdateBookingStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateBookingStatus(vars: UpdateBookingStatusVariables): MutationPromise<UpdateBookingStatusData, UpdateBookingStatusVariables>;

interface UpdateBookingStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateBookingStatusVariables): MutationRef<UpdateBookingStatusData, UpdateBookingStatusVariables>;
}
export const updateBookingStatusRef: UpdateBookingStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateBookingStatus(dc: DataConnect, vars: UpdateBookingStatusVariables): MutationPromise<UpdateBookingStatusData, UpdateBookingStatusVariables>;

interface UpdateBookingStatusRef {
  ...
  (dc: DataConnect, vars: UpdateBookingStatusVariables): MutationRef<UpdateBookingStatusData, UpdateBookingStatusVariables>;
}
export const updateBookingStatusRef: UpdateBookingStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateBookingStatusRef:
```typescript
const name = updateBookingStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateBookingStatus` mutation requires an argument of type `UpdateBookingStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateBookingStatusVariables {
  id: UUIDString;
  status: BookingStatus;
}
```
### Return Type
Recall that executing the `UpdateBookingStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateBookingStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateBookingStatusData {
  booking_update?: Booking_Key | null;
}
```
### Using `UpdateBookingStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateBookingStatus, UpdateBookingStatusVariables } from '@dataconnect/generated';

// The `UpdateBookingStatus` mutation requires an argument of type `UpdateBookingStatusVariables`:
const updateBookingStatusVars: UpdateBookingStatusVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateBookingStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateBookingStatus(updateBookingStatusVars);
// Variables can be defined inline as well.
const { data } = await updateBookingStatus({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateBookingStatus(dataConnect, updateBookingStatusVars);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
updateBookingStatus(updateBookingStatusVars).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

### Using `UpdateBookingStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateBookingStatusRef, UpdateBookingStatusVariables } from '@dataconnect/generated';

// The `UpdateBookingStatus` mutation requires an argument of type `UpdateBookingStatusVariables`:
const updateBookingStatusVars: UpdateBookingStatusVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateBookingStatusRef()` function to get a reference to the mutation.
const ref = updateBookingStatusRef(updateBookingStatusVars);
// Variables can be defined inline as well.
const ref = updateBookingStatusRef({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateBookingStatusRef(dataConnect, updateBookingStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_update);
});
```

## CreateGuestTicketRequest
You can execute the `CreateGuestTicketRequest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createGuestTicketRequest(vars: CreateGuestTicketRequestVariables): MutationPromise<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;

interface CreateGuestTicketRequestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGuestTicketRequestVariables): MutationRef<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;
}
export const createGuestTicketRequestRef: CreateGuestTicketRequestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createGuestTicketRequest(dc: DataConnect, vars: CreateGuestTicketRequestVariables): MutationPromise<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;

interface CreateGuestTicketRequestRef {
  ...
  (dc: DataConnect, vars: CreateGuestTicketRequestVariables): MutationRef<CreateGuestTicketRequestData, CreateGuestTicketRequestVariables>;
}
export const createGuestTicketRequestRef: CreateGuestTicketRequestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createGuestTicketRequestRef:
```typescript
const name = createGuestTicketRequestRef.operationName;
console.log(name);
```

### Variables
The `CreateGuestTicketRequest` mutation requires an argument of type `CreateGuestTicketRequestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateGuestTicketRequestVariables {
  bookingId: UUIDString;
  requestedGuestCount: number;
  guestTicketTypeId: UUIDString;
  guestDisplayName: string;
  dietaryNote?: string | null;
}
```
### Return Type
Recall that executing the `CreateGuestTicketRequest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateGuestTicketRequestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateGuestTicketRequestData {
  guestTicketRequest_insert: GuestTicketRequest_Key;
}
```
### Using `CreateGuestTicketRequest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createGuestTicketRequest, CreateGuestTicketRequestVariables } from '@dataconnect/generated';

// The `CreateGuestTicketRequest` mutation requires an argument of type `CreateGuestTicketRequestVariables`:
const createGuestTicketRequestVars: CreateGuestTicketRequestVariables = {
  bookingId: ..., 
  requestedGuestCount: ..., 
  guestTicketTypeId: ..., 
  guestDisplayName: ..., 
  dietaryNote: ..., // optional
};

// Call the `createGuestTicketRequest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createGuestTicketRequest(createGuestTicketRequestVars);
// Variables can be defined inline as well.
const { data } = await createGuestTicketRequest({ bookingId: ..., requestedGuestCount: ..., guestTicketTypeId: ..., guestDisplayName: ..., dietaryNote: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createGuestTicketRequest(dataConnect, createGuestTicketRequestVars);

console.log(data.guestTicketRequest_insert);

// Or, you can use the `Promise` API.
createGuestTicketRequest(createGuestTicketRequestVars).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_insert);
});
```

### Using `CreateGuestTicketRequest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createGuestTicketRequestRef, CreateGuestTicketRequestVariables } from '@dataconnect/generated';

// The `CreateGuestTicketRequest` mutation requires an argument of type `CreateGuestTicketRequestVariables`:
const createGuestTicketRequestVars: CreateGuestTicketRequestVariables = {
  bookingId: ..., 
  requestedGuestCount: ..., 
  guestTicketTypeId: ..., 
  guestDisplayName: ..., 
  dietaryNote: ..., // optional
};

// Call the `createGuestTicketRequestRef()` function to get a reference to the mutation.
const ref = createGuestTicketRequestRef(createGuestTicketRequestVars);
// Variables can be defined inline as well.
const ref = createGuestTicketRequestRef({ bookingId: ..., requestedGuestCount: ..., guestTicketTypeId: ..., guestDisplayName: ..., dietaryNote: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createGuestTicketRequestRef(dataConnect, createGuestTicketRequestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.guestTicketRequest_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_insert);
});
```

## AdminDeleteGuestTicketRequest
You can execute the `AdminDeleteGuestTicketRequest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
adminDeleteGuestTicketRequest(vars: AdminDeleteGuestTicketRequestVariables): MutationPromise<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;

interface AdminDeleteGuestTicketRequestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDeleteGuestTicketRequestVariables): MutationRef<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;
}
export const adminDeleteGuestTicketRequestRef: AdminDeleteGuestTicketRequestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminDeleteGuestTicketRequest(dc: DataConnect, vars: AdminDeleteGuestTicketRequestVariables): MutationPromise<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;

interface AdminDeleteGuestTicketRequestRef {
  ...
  (dc: DataConnect, vars: AdminDeleteGuestTicketRequestVariables): MutationRef<AdminDeleteGuestTicketRequestData, AdminDeleteGuestTicketRequestVariables>;
}
export const adminDeleteGuestTicketRequestRef: AdminDeleteGuestTicketRequestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminDeleteGuestTicketRequestRef:
```typescript
const name = adminDeleteGuestTicketRequestRef.operationName;
console.log(name);
```

### Variables
The `AdminDeleteGuestTicketRequest` mutation requires an argument of type `AdminDeleteGuestTicketRequestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminDeleteGuestTicketRequestVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `AdminDeleteGuestTicketRequest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminDeleteGuestTicketRequestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminDeleteGuestTicketRequestData {
  guestTicketRequest_delete?: GuestTicketRequest_Key | null;
}
```
### Using `AdminDeleteGuestTicketRequest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminDeleteGuestTicketRequest, AdminDeleteGuestTicketRequestVariables } from '@dataconnect/generated';

// The `AdminDeleteGuestTicketRequest` mutation requires an argument of type `AdminDeleteGuestTicketRequestVariables`:
const adminDeleteGuestTicketRequestVars: AdminDeleteGuestTicketRequestVariables = {
  id: ..., 
};

// Call the `adminDeleteGuestTicketRequest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminDeleteGuestTicketRequest(adminDeleteGuestTicketRequestVars);
// Variables can be defined inline as well.
const { data } = await adminDeleteGuestTicketRequest({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminDeleteGuestTicketRequest(dataConnect, adminDeleteGuestTicketRequestVars);

console.log(data.guestTicketRequest_delete);

// Or, you can use the `Promise` API.
adminDeleteGuestTicketRequest(adminDeleteGuestTicketRequestVars).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_delete);
});
```

### Using `AdminDeleteGuestTicketRequest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminDeleteGuestTicketRequestRef, AdminDeleteGuestTicketRequestVariables } from '@dataconnect/generated';

// The `AdminDeleteGuestTicketRequest` mutation requires an argument of type `AdminDeleteGuestTicketRequestVariables`:
const adminDeleteGuestTicketRequestVars: AdminDeleteGuestTicketRequestVariables = {
  id: ..., 
};

// Call the `adminDeleteGuestTicketRequestRef()` function to get a reference to the mutation.
const ref = adminDeleteGuestTicketRequestRef(adminDeleteGuestTicketRequestVars);
// Variables can be defined inline as well.
const ref = adminDeleteGuestTicketRequestRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminDeleteGuestTicketRequestRef(dataConnect, adminDeleteGuestTicketRequestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.guestTicketRequest_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_delete);
});
```

## AdminReviewGuestTicketRequest
You can execute the `AdminReviewGuestTicketRequest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
adminReviewGuestTicketRequest(vars: AdminReviewGuestTicketRequestVariables): MutationPromise<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;

interface AdminReviewGuestTicketRequestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminReviewGuestTicketRequestVariables): MutationRef<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;
}
export const adminReviewGuestTicketRequestRef: AdminReviewGuestTicketRequestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminReviewGuestTicketRequest(dc: DataConnect, vars: AdminReviewGuestTicketRequestVariables): MutationPromise<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;

interface AdminReviewGuestTicketRequestRef {
  ...
  (dc: DataConnect, vars: AdminReviewGuestTicketRequestVariables): MutationRef<AdminReviewGuestTicketRequestData, AdminReviewGuestTicketRequestVariables>;
}
export const adminReviewGuestTicketRequestRef: AdminReviewGuestTicketRequestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminReviewGuestTicketRequestRef:
```typescript
const name = adminReviewGuestTicketRequestRef.operationName;
console.log(name);
```

### Variables
The `AdminReviewGuestTicketRequest` mutation requires an argument of type `AdminReviewGuestTicketRequestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminReviewGuestTicketRequestVariables {
  id: UUIDString;
  status: GuestTicketRequestStatus;
  moderatorNote?: string | null;
}
```
### Return Type
Recall that executing the `AdminReviewGuestTicketRequest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminReviewGuestTicketRequestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminReviewGuestTicketRequestData {
  guestTicketRequest_update?: GuestTicketRequest_Key | null;
}
```
### Using `AdminReviewGuestTicketRequest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminReviewGuestTicketRequest, AdminReviewGuestTicketRequestVariables } from '@dataconnect/generated';

// The `AdminReviewGuestTicketRequest` mutation requires an argument of type `AdminReviewGuestTicketRequestVariables`:
const adminReviewGuestTicketRequestVars: AdminReviewGuestTicketRequestVariables = {
  id: ..., 
  status: ..., 
  moderatorNote: ..., // optional
};

// Call the `adminReviewGuestTicketRequest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminReviewGuestTicketRequest(adminReviewGuestTicketRequestVars);
// Variables can be defined inline as well.
const { data } = await adminReviewGuestTicketRequest({ id: ..., status: ..., moderatorNote: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminReviewGuestTicketRequest(dataConnect, adminReviewGuestTicketRequestVars);

console.log(data.guestTicketRequest_update);

// Or, you can use the `Promise` API.
adminReviewGuestTicketRequest(adminReviewGuestTicketRequestVars).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_update);
});
```

### Using `AdminReviewGuestTicketRequest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminReviewGuestTicketRequestRef, AdminReviewGuestTicketRequestVariables } from '@dataconnect/generated';

// The `AdminReviewGuestTicketRequest` mutation requires an argument of type `AdminReviewGuestTicketRequestVariables`:
const adminReviewGuestTicketRequestVars: AdminReviewGuestTicketRequestVariables = {
  id: ..., 
  status: ..., 
  moderatorNote: ..., // optional
};

// Call the `adminReviewGuestTicketRequestRef()` function to get a reference to the mutation.
const ref = adminReviewGuestTicketRequestRef(adminReviewGuestTicketRequestVars);
// Variables can be defined inline as well.
const ref = adminReviewGuestTicketRequestRef({ id: ..., status: ..., moderatorNote: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminReviewGuestTicketRequestRef(dataConnect, adminReviewGuestTicketRequestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.guestTicketRequest_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.guestTicketRequest_update);
});
```

## AdminDeleteBookingLine
You can execute the `AdminDeleteBookingLine` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
adminDeleteBookingLine(vars: AdminDeleteBookingLineVariables): MutationPromise<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;

interface AdminDeleteBookingLineRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDeleteBookingLineVariables): MutationRef<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;
}
export const adminDeleteBookingLineRef: AdminDeleteBookingLineRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminDeleteBookingLine(dc: DataConnect, vars: AdminDeleteBookingLineVariables): MutationPromise<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;

interface AdminDeleteBookingLineRef {
  ...
  (dc: DataConnect, vars: AdminDeleteBookingLineVariables): MutationRef<AdminDeleteBookingLineData, AdminDeleteBookingLineVariables>;
}
export const adminDeleteBookingLineRef: AdminDeleteBookingLineRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminDeleteBookingLineRef:
```typescript
const name = adminDeleteBookingLineRef.operationName;
console.log(name);
```

### Variables
The `AdminDeleteBookingLine` mutation requires an argument of type `AdminDeleteBookingLineVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminDeleteBookingLineVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `AdminDeleteBookingLine` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminDeleteBookingLineData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminDeleteBookingLineData {
  bookingLine_delete?: BookingLine_Key | null;
}
```
### Using `AdminDeleteBookingLine`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminDeleteBookingLine, AdminDeleteBookingLineVariables } from '@dataconnect/generated';

// The `AdminDeleteBookingLine` mutation requires an argument of type `AdminDeleteBookingLineVariables`:
const adminDeleteBookingLineVars: AdminDeleteBookingLineVariables = {
  id: ..., 
};

// Call the `adminDeleteBookingLine()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminDeleteBookingLine(adminDeleteBookingLineVars);
// Variables can be defined inline as well.
const { data } = await adminDeleteBookingLine({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminDeleteBookingLine(dataConnect, adminDeleteBookingLineVars);

console.log(data.bookingLine_delete);

// Or, you can use the `Promise` API.
adminDeleteBookingLine(adminDeleteBookingLineVars).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_delete);
});
```

### Using `AdminDeleteBookingLine`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminDeleteBookingLineRef, AdminDeleteBookingLineVariables } from '@dataconnect/generated';

// The `AdminDeleteBookingLine` mutation requires an argument of type `AdminDeleteBookingLineVariables`:
const adminDeleteBookingLineVars: AdminDeleteBookingLineVariables = {
  id: ..., 
};

// Call the `adminDeleteBookingLineRef()` function to get a reference to the mutation.
const ref = adminDeleteBookingLineRef(adminDeleteBookingLineVars);
// Variables can be defined inline as well.
const ref = adminDeleteBookingLineRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminDeleteBookingLineRef(dataConnect, adminDeleteBookingLineVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.bookingLine_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.bookingLine_delete);
});
```

## AdminDeleteBooking
You can execute the `AdminDeleteBooking` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
adminDeleteBooking(vars: AdminDeleteBookingVariables): MutationPromise<AdminDeleteBookingData, AdminDeleteBookingVariables>;

interface AdminDeleteBookingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDeleteBookingVariables): MutationRef<AdminDeleteBookingData, AdminDeleteBookingVariables>;
}
export const adminDeleteBookingRef: AdminDeleteBookingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminDeleteBooking(dc: DataConnect, vars: AdminDeleteBookingVariables): MutationPromise<AdminDeleteBookingData, AdminDeleteBookingVariables>;

interface AdminDeleteBookingRef {
  ...
  (dc: DataConnect, vars: AdminDeleteBookingVariables): MutationRef<AdminDeleteBookingData, AdminDeleteBookingVariables>;
}
export const adminDeleteBookingRef: AdminDeleteBookingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminDeleteBookingRef:
```typescript
const name = adminDeleteBookingRef.operationName;
console.log(name);
```

### Variables
The `AdminDeleteBooking` mutation requires an argument of type `AdminDeleteBookingVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminDeleteBookingVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `AdminDeleteBooking` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminDeleteBookingData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminDeleteBookingData {
  booking_delete?: Booking_Key | null;
}
```
### Using `AdminDeleteBooking`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminDeleteBooking, AdminDeleteBookingVariables } from '@dataconnect/generated';

// The `AdminDeleteBooking` mutation requires an argument of type `AdminDeleteBookingVariables`:
const adminDeleteBookingVars: AdminDeleteBookingVariables = {
  id: ..., 
};

// Call the `adminDeleteBooking()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminDeleteBooking(adminDeleteBookingVars);
// Variables can be defined inline as well.
const { data } = await adminDeleteBooking({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminDeleteBooking(dataConnect, adminDeleteBookingVars);

console.log(data.booking_delete);

// Or, you can use the `Promise` API.
adminDeleteBooking(adminDeleteBookingVars).then((response) => {
  const data = response.data;
  console.log(data.booking_delete);
});
```

### Using `AdminDeleteBooking`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminDeleteBookingRef, AdminDeleteBookingVariables } from '@dataconnect/generated';

// The `AdminDeleteBooking` mutation requires an argument of type `AdminDeleteBookingVariables`:
const adminDeleteBookingVars: AdminDeleteBookingVariables = {
  id: ..., 
};

// Call the `adminDeleteBookingRef()` function to get a reference to the mutation.
const ref = adminDeleteBookingRef(adminDeleteBookingVars);
// Variables can be defined inline as well.
const ref = adminDeleteBookingRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminDeleteBookingRef(dataConnect, adminDeleteBookingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.booking_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.booking_delete);
});
```

## ResolvePaymentReconciliationException
You can execute the `ResolvePaymentReconciliationException` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
resolvePaymentReconciliationException(vars: ResolvePaymentReconciliationExceptionVariables): MutationPromise<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;

interface ResolvePaymentReconciliationExceptionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ResolvePaymentReconciliationExceptionVariables): MutationRef<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;
}
export const resolvePaymentReconciliationExceptionRef: ResolvePaymentReconciliationExceptionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
resolvePaymentReconciliationException(dc: DataConnect, vars: ResolvePaymentReconciliationExceptionVariables): MutationPromise<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;

interface ResolvePaymentReconciliationExceptionRef {
  ...
  (dc: DataConnect, vars: ResolvePaymentReconciliationExceptionVariables): MutationRef<ResolvePaymentReconciliationExceptionData, ResolvePaymentReconciliationExceptionVariables>;
}
export const resolvePaymentReconciliationExceptionRef: ResolvePaymentReconciliationExceptionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the resolvePaymentReconciliationExceptionRef:
```typescript
const name = resolvePaymentReconciliationExceptionRef.operationName;
console.log(name);
```

### Variables
The `ResolvePaymentReconciliationException` mutation requires an argument of type `ResolvePaymentReconciliationExceptionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ResolvePaymentReconciliationExceptionVariables {
  id: UUIDString;
  note?: string | null;
}
```
### Return Type
Recall that executing the `ResolvePaymentReconciliationException` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ResolvePaymentReconciliationExceptionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ResolvePaymentReconciliationExceptionData {
  paymentReconciliationException_update?: PaymentReconciliationException_Key | null;
}
```
### Using `ResolvePaymentReconciliationException`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, resolvePaymentReconciliationException, ResolvePaymentReconciliationExceptionVariables } from '@dataconnect/generated';

// The `ResolvePaymentReconciliationException` mutation requires an argument of type `ResolvePaymentReconciliationExceptionVariables`:
const resolvePaymentReconciliationExceptionVars: ResolvePaymentReconciliationExceptionVariables = {
  id: ..., 
  note: ..., // optional
};

// Call the `resolvePaymentReconciliationException()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await resolvePaymentReconciliationException(resolvePaymentReconciliationExceptionVars);
// Variables can be defined inline as well.
const { data } = await resolvePaymentReconciliationException({ id: ..., note: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await resolvePaymentReconciliationException(dataConnect, resolvePaymentReconciliationExceptionVars);

console.log(data.paymentReconciliationException_update);

// Or, you can use the `Promise` API.
resolvePaymentReconciliationException(resolvePaymentReconciliationExceptionVars).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationException_update);
});
```

### Using `ResolvePaymentReconciliationException`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, resolvePaymentReconciliationExceptionRef, ResolvePaymentReconciliationExceptionVariables } from '@dataconnect/generated';

// The `ResolvePaymentReconciliationException` mutation requires an argument of type `ResolvePaymentReconciliationExceptionVariables`:
const resolvePaymentReconciliationExceptionVars: ResolvePaymentReconciliationExceptionVariables = {
  id: ..., 
  note: ..., // optional
};

// Call the `resolvePaymentReconciliationExceptionRef()` function to get a reference to the mutation.
const ref = resolvePaymentReconciliationExceptionRef(resolvePaymentReconciliationExceptionVars);
// Variables can be defined inline as well.
const ref = resolvePaymentReconciliationExceptionRef({ id: ..., note: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = resolvePaymentReconciliationExceptionRef(dataConnect, resolvePaymentReconciliationExceptionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.paymentReconciliationException_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.paymentReconciliationException_update);
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
  purposes?: SectionUserGroupPurpose[] | null;
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
  purposes: ..., // optional
};

// Call the `grantUserGroupToSectionForPurpose()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await grantUserGroupToSectionForPurpose(grantUserGroupToSectionForPurposeVars);
// Variables can be defined inline as well.
const { data } = await grantUserGroupToSectionForPurpose({ sectionId: ..., userGroupId: ..., purposes: ..., });

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
  purposes: ..., // optional
};

// Call the `grantUserGroupToSectionForPurposeRef()` function to get a reference to the mutation.
const ref = grantUserGroupToSectionForPurposeRef(grantUserGroupToSectionForPurposeVars);
// Variables can be defined inline as well.
const ref = grantUserGroupToSectionForPurposeRef({ sectionId: ..., userGroupId: ..., purposes: ..., });

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
};

// Call the `revokeUserGroupFromSectionForPurpose()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await revokeUserGroupFromSectionForPurpose(revokeUserGroupFromSectionForPurposeVars);
// Variables can be defined inline as well.
const { data } = await revokeUserGroupFromSectionForPurpose({ sectionId: ..., userGroupId: ..., });

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
};

// Call the `revokeUserGroupFromSectionForPurposeRef()` function to get a reference to the mutation.
const ref = revokeUserGroupFromSectionForPurposeRef(revokeUserGroupFromSectionForPurposeVars);
// Variables can be defined inline as well.
const ref = revokeUserGroupFromSectionForPurposeRef({ sectionId: ..., userGroupId: ..., });

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
  maxGuestsWithoutModeratorApproval?: number | null;
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
  maxGuestsWithoutModeratorApproval: ..., // optional
};

// Call the `createEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createEvent(createEventVars);
// Variables can be defined inline as well.
const { data } = await createEvent({ sectionId: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., maxGuestsWithoutModeratorApproval: ..., });

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
  maxGuestsWithoutModeratorApproval: ..., // optional
};

// Call the `createEventRef()` function to get a reference to the mutation.
const ref = createEventRef(createEventVars);
// Variables can be defined inline as well.
const ref = createEventRef({ sectionId: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., maxGuestsWithoutModeratorApproval: ..., });

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
  maxGuestsWithoutModeratorApproval?: number | null;
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
  maxGuestsWithoutModeratorApproval: ..., // optional
};

// Call the `updateEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateEvent(updateEventVars);
// Variables can be defined inline as well.
const { data } = await updateEvent({ id: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., maxGuestsWithoutModeratorApproval: ..., });

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
  maxGuestsWithoutModeratorApproval: ..., // optional
};

// Call the `updateEventRef()` function to get a reference to the mutation.
const ref = updateEventRef(updateEventVars);
// Variables can be defined inline as well.
const ref = updateEventRef({ id: ..., title: ..., location: ..., guestOfHonour: ..., startDateTime: ..., endDateTime: ..., bookingStartDateTime: ..., bookingEndDateTime: ..., maxGuestsWithoutModeratorApproval: ..., });

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
  audience: TicketAudience;
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
  audience: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., // optional
};

// Call the `createTicketType()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createTicketType(createTicketTypeVars);
// Variables can be defined inline as well.
const { data } = await createTicketType({ eventId: ..., userGroupId: ..., audience: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

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
  audience: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., // optional
};

// Call the `createTicketTypeRef()` function to get a reference to the mutation.
const ref = createTicketTypeRef(createTicketTypeVars);
// Variables can be defined inline as well.
const ref = createTicketTypeRef({ eventId: ..., userGroupId: ..., audience: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

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
  audience: TicketAudience;
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
  audience: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., 
};

// Call the `updateTicketType()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateTicketType(updateTicketTypeVars);
// Variables can be defined inline as well.
const { data } = await updateTicketType({ id: ..., userGroupId: ..., audience: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

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
  audience: ..., 
  title: ..., 
  description: ..., // optional
  price: ..., 
  sortOrder: ..., 
};

// Call the `updateTicketTypeRef()` function to get a reference to the mutation.
const ref = updateTicketTypeRef(updateTicketTypeVars);
// Variables can be defined inline as well.
const ref = updateTicketTypeRef({ id: ..., userGroupId: ..., audience: ..., title: ..., description: ..., price: ..., sortOrder: ..., });

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
const { data } = await createUserProfile({ firstName: ..., lastName: ..., serviceNumber: ..., requestedMembershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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
const ref = createUserProfileRef({ firstName: ..., lastName: ..., serviceNumber: ..., requestedMembershipStatus: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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
const { data } = await upsertUser({ firstName: ..., lastName: ..., serviceNumber: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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
  serviceNumber: ..., 
  isRegular: ..., // optional
  isReserve: ..., // optional
  isCivilServant: ..., // optional
  isIndustry: ..., // optional
};

// Call the `upsertUserRef()` function to get a reference to the mutation.
const ref = upsertUserRef(upsertUserVars);
// Variables can be defined inline as well.
const ref = upsertUserRef({ firstName: ..., lastName: ..., serviceNumber: ..., isRegular: ..., isReserve: ..., isCivilServant: ..., isIndustry: ..., });

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

## OptOutSectionAnnouncement
You can execute the `OptOutSectionAnnouncement` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
optOutSectionAnnouncement(vars: OptOutSectionAnnouncementVariables): MutationPromise<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;

interface OptOutSectionAnnouncementRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: OptOutSectionAnnouncementVariables): MutationRef<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;
}
export const optOutSectionAnnouncementRef: OptOutSectionAnnouncementRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
optOutSectionAnnouncement(dc: DataConnect, vars: OptOutSectionAnnouncementVariables): MutationPromise<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;

interface OptOutSectionAnnouncementRef {
  ...
  (dc: DataConnect, vars: OptOutSectionAnnouncementVariables): MutationRef<OptOutSectionAnnouncementData, OptOutSectionAnnouncementVariables>;
}
export const optOutSectionAnnouncementRef: OptOutSectionAnnouncementRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the optOutSectionAnnouncementRef:
```typescript
const name = optOutSectionAnnouncementRef.operationName;
console.log(name);
```

### Variables
The `OptOutSectionAnnouncement` mutation requires an argument of type `OptOutSectionAnnouncementVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface OptOutSectionAnnouncementVariables {
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `OptOutSectionAnnouncement` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `OptOutSectionAnnouncementData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface OptOutSectionAnnouncementData {
  sectionAnnouncementOptOut_upsert: SectionAnnouncementOptOut_Key;
}
```
### Using `OptOutSectionAnnouncement`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, optOutSectionAnnouncement, OptOutSectionAnnouncementVariables } from '@dataconnect/generated';

// The `OptOutSectionAnnouncement` mutation requires an argument of type `OptOutSectionAnnouncementVariables`:
const optOutSectionAnnouncementVars: OptOutSectionAnnouncementVariables = {
  sectionId: ..., 
};

// Call the `optOutSectionAnnouncement()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await optOutSectionAnnouncement(optOutSectionAnnouncementVars);
// Variables can be defined inline as well.
const { data } = await optOutSectionAnnouncement({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await optOutSectionAnnouncement(dataConnect, optOutSectionAnnouncementVars);

console.log(data.sectionAnnouncementOptOut_upsert);

// Or, you can use the `Promise` API.
optOutSectionAnnouncement(optOutSectionAnnouncementVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_upsert);
});
```

### Using `OptOutSectionAnnouncement`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, optOutSectionAnnouncementRef, OptOutSectionAnnouncementVariables } from '@dataconnect/generated';

// The `OptOutSectionAnnouncement` mutation requires an argument of type `OptOutSectionAnnouncementVariables`:
const optOutSectionAnnouncementVars: OptOutSectionAnnouncementVariables = {
  sectionId: ..., 
};

// Call the `optOutSectionAnnouncementRef()` function to get a reference to the mutation.
const ref = optOutSectionAnnouncementRef(optOutSectionAnnouncementVars);
// Variables can be defined inline as well.
const ref = optOutSectionAnnouncementRef({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = optOutSectionAnnouncementRef(dataConnect, optOutSectionAnnouncementVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionAnnouncementOptOut_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_upsert);
});
```

## OptInSectionAnnouncement
You can execute the `OptInSectionAnnouncement` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
optInSectionAnnouncement(vars: OptInSectionAnnouncementVariables): MutationPromise<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;

interface OptInSectionAnnouncementRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: OptInSectionAnnouncementVariables): MutationRef<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;
}
export const optInSectionAnnouncementRef: OptInSectionAnnouncementRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
optInSectionAnnouncement(dc: DataConnect, vars: OptInSectionAnnouncementVariables): MutationPromise<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;

interface OptInSectionAnnouncementRef {
  ...
  (dc: DataConnect, vars: OptInSectionAnnouncementVariables): MutationRef<OptInSectionAnnouncementData, OptInSectionAnnouncementVariables>;
}
export const optInSectionAnnouncementRef: OptInSectionAnnouncementRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the optInSectionAnnouncementRef:
```typescript
const name = optInSectionAnnouncementRef.operationName;
console.log(name);
```

### Variables
The `OptInSectionAnnouncement` mutation requires an argument of type `OptInSectionAnnouncementVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface OptInSectionAnnouncementVariables {
  sectionId: UUIDString;
}
```
### Return Type
Recall that executing the `OptInSectionAnnouncement` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `OptInSectionAnnouncementData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface OptInSectionAnnouncementData {
  sectionAnnouncementOptOut_delete?: SectionAnnouncementOptOut_Key | null;
}
```
### Using `OptInSectionAnnouncement`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, optInSectionAnnouncement, OptInSectionAnnouncementVariables } from '@dataconnect/generated';

// The `OptInSectionAnnouncement` mutation requires an argument of type `OptInSectionAnnouncementVariables`:
const optInSectionAnnouncementVars: OptInSectionAnnouncementVariables = {
  sectionId: ..., 
};

// Call the `optInSectionAnnouncement()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await optInSectionAnnouncement(optInSectionAnnouncementVars);
// Variables can be defined inline as well.
const { data } = await optInSectionAnnouncement({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await optInSectionAnnouncement(dataConnect, optInSectionAnnouncementVars);

console.log(data.sectionAnnouncementOptOut_delete);

// Or, you can use the `Promise` API.
optInSectionAnnouncement(optInSectionAnnouncementVars).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_delete);
});
```

### Using `OptInSectionAnnouncement`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, optInSectionAnnouncementRef, OptInSectionAnnouncementVariables } from '@dataconnect/generated';

// The `OptInSectionAnnouncement` mutation requires an argument of type `OptInSectionAnnouncementVariables`:
const optInSectionAnnouncementVars: OptInSectionAnnouncementVariables = {
  sectionId: ..., 
};

// Call the `optInSectionAnnouncementRef()` function to get a reference to the mutation.
const ref = optInSectionAnnouncementRef(optInSectionAnnouncementVars);
// Variables can be defined inline as well.
const ref = optInSectionAnnouncementRef({ sectionId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = optInSectionAnnouncementRef(dataConnect, optInSectionAnnouncementVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.sectionAnnouncementOptOut_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.sectionAnnouncementOptOut_delete);
});
```

