# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useUpdateUserMembershipStatus, useDeleteUser, useCreateUser, useCreateUserGroupAdmin, useAddUserToUserGroupAdmin, useRemoveUserFromUserGroupAdmin, useGetUserGroupByName, useGetUserUserGroupsForAdmin, useGetCurrentUser, useGetUserById } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useUpdateUserMembershipStatus(updateUserMembershipStatusVars);

const { data, isPending, isSuccess, isError, error } = useDeleteUser(deleteUserVars);

const { data, isPending, isSuccess, isError, error } = useCreateUser(createUserVars);

const { data, isPending, isSuccess, isError, error } = useCreateUserGroupAdmin(createUserGroupAdminVars);

const { data, isPending, isSuccess, isError, error } = useAddUserToUserGroupAdmin(addUserToUserGroupAdminVars);

const { data, isPending, isSuccess, isError, error } = useRemoveUserFromUserGroupAdmin(removeUserFromUserGroupAdminVars);

const { data, isPending, isSuccess, isError, error } = useGetUserGroupByName(getUserGroupByNameVars);

const { data, isPending, isSuccess, isError, error } = useGetUserUserGroupsForAdmin(getUserUserGroupsForAdminVars);

const { data, isPending, isSuccess, isError, error } = useGetCurrentUser();

const { data, isPending, isSuccess, isError, error } = useGetUserById(getUserByIdVars);

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
import { updateUserMembershipStatus, deleteUser, createUser, createUserGroupAdmin, addUserToUserGroupAdmin, removeUserFromUserGroupAdmin, getUserGroupByName, getUserUserGroupsForAdmin, getCurrentUser, getUserById } from '@dataconnect/generated';


// Operation UpdateUserMembershipStatus:  For variables, look at type UpdateUserMembershipStatusVars in ../index.d.ts
const { data } = await UpdateUserMembershipStatus(dataConnect, updateUserMembershipStatusVars);

// Operation DeleteUser:  For variables, look at type DeleteUserVars in ../index.d.ts
const { data } = await DeleteUser(dataConnect, deleteUserVars);

// Operation CreateUser:  For variables, look at type CreateUserVars in ../index.d.ts
const { data } = await CreateUser(dataConnect, createUserVars);

// Operation CreateUserGroupAdmin:  For variables, look at type CreateUserGroupAdminVars in ../index.d.ts
const { data } = await CreateUserGroupAdmin(dataConnect, createUserGroupAdminVars);

// Operation AddUserToUserGroupAdmin:  For variables, look at type AddUserToUserGroupAdminVars in ../index.d.ts
const { data } = await AddUserToUserGroupAdmin(dataConnect, addUserToUserGroupAdminVars);

// Operation RemoveUserFromUserGroupAdmin:  For variables, look at type RemoveUserFromUserGroupAdminVars in ../index.d.ts
const { data } = await RemoveUserFromUserGroupAdmin(dataConnect, removeUserFromUserGroupAdminVars);

// Operation GetUserGroupByName:  For variables, look at type GetUserGroupByNameVars in ../index.d.ts
const { data } = await GetUserGroupByName(dataConnect, getUserGroupByNameVars);

// Operation GetUserUserGroupsForAdmin:  For variables, look at type GetUserUserGroupsForAdminVars in ../index.d.ts
const { data } = await GetUserUserGroupsForAdmin(dataConnect, getUserUserGroupsForAdminVars);

// Operation GetCurrentUser: 
const { data } = await GetCurrentUser(dataConnect);

// Operation GetUserById:  For variables, look at type GetUserByIdVars in ../index.d.ts
const { data } = await GetUserById(dataConnect, getUserByIdVars);


```