# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateUserProfile, useUpsertUser, useUpdateUser, useRegisterForSection, useUnregisterFromSection, useSubscribeToUserGroup, useUnsubscribeFromUserGroup, useUpdateUserMembershipStatus, useDeleteUser, useCreateUser } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateUserProfile(createUserProfileVars);

const { data, isPending, isSuccess, isError, error } = useUpsertUser(upsertUserVars);

const { data, isPending, isSuccess, isError, error } = useUpdateUser(updateUserVars);

const { data, isPending, isSuccess, isError, error } = useRegisterForSection(registerForSectionVars);

const { data, isPending, isSuccess, isError, error } = useUnregisterFromSection(unregisterFromSectionVars);

const { data, isPending, isSuccess, isError, error } = useSubscribeToUserGroup(subscribeToUserGroupVars);

const { data, isPending, isSuccess, isError, error } = useUnsubscribeFromUserGroup(unsubscribeFromUserGroupVars);

const { data, isPending, isSuccess, isError, error } = useUpdateUserMembershipStatus(updateUserMembershipStatusVars);

const { data, isPending, isSuccess, isError, error } = useDeleteUser(deleteUserVars);

const { data, isPending, isSuccess, isError, error } = useCreateUser(createUserVars);

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createUserProfile, upsertUser, updateUser, registerForSection, unregisterFromSection, subscribeToUserGroup, unsubscribeFromUserGroup, updateUserMembershipStatus, deleteUser, createUser } from '@dataconnect/generated';


// Operation CreateUserProfile:  For variables, look at type CreateUserProfileVars in ../index.d.ts
const { data } = await CreateUserProfile(dataConnect, createUserProfileVars);

// Operation UpsertUser:  For variables, look at type UpsertUserVars in ../index.d.ts
const { data } = await UpsertUser(dataConnect, upsertUserVars);

// Operation UpdateUser:  For variables, look at type UpdateUserVars in ../index.d.ts
const { data } = await UpdateUser(dataConnect, updateUserVars);

// Operation RegisterForSection:  For variables, look at type RegisterForSectionVars in ../index.d.ts
const { data } = await RegisterForSection(dataConnect, registerForSectionVars);

// Operation UnregisterFromSection:  For variables, look at type UnregisterFromSectionVars in ../index.d.ts
const { data } = await UnregisterFromSection(dataConnect, unregisterFromSectionVars);

// Operation SubscribeToUserGroup:  For variables, look at type SubscribeToUserGroupVars in ../index.d.ts
const { data } = await SubscribeToUserGroup(dataConnect, subscribeToUserGroupVars);

// Operation UnsubscribeFromUserGroup:  For variables, look at type UnsubscribeFromUserGroupVars in ../index.d.ts
const { data } = await UnsubscribeFromUserGroup(dataConnect, unsubscribeFromUserGroupVars);

// Operation UpdateUserMembershipStatus:  For variables, look at type UpdateUserMembershipStatusVars in ../index.d.ts
const { data } = await UpdateUserMembershipStatus(dataConnect, updateUserMembershipStatusVars);

// Operation DeleteUser:  For variables, look at type DeleteUserVars in ../index.d.ts
const { data } = await DeleteUser(dataConnect, deleteUserVars);

// Operation CreateUser:  For variables, look at type CreateUserVars in ../index.d.ts
const { data } = await CreateUser(dataConnect, createUserVars);


```