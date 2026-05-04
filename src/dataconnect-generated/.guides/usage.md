# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateSection, useCreateUserGroup, useAddUserToUserGroup, useRemoveUserFromUserGroup, useGrantUserGroupToSectionForPurpose, useRevokeUserGroupFromSectionForPurpose, useUpdateUserGroup, useDeleteUserGroup, useUpdateSection, useDeleteSection } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateSection(createSectionVars);

const { data, isPending, isSuccess, isError, error } = useCreateUserGroup(createUserGroupVars);

const { data, isPending, isSuccess, isError, error } = useAddUserToUserGroup(addUserToUserGroupVars);

const { data, isPending, isSuccess, isError, error } = useRemoveUserFromUserGroup(removeUserFromUserGroupVars);

const { data, isPending, isSuccess, isError, error } = useGrantUserGroupToSectionForPurpose(grantUserGroupToSectionForPurposeVars);

const { data, isPending, isSuccess, isError, error } = useRevokeUserGroupFromSectionForPurpose(revokeUserGroupFromSectionForPurposeVars);

const { data, isPending, isSuccess, isError, error } = useUpdateUserGroup(updateUserGroupVars);

const { data, isPending, isSuccess, isError, error } = useDeleteUserGroup(deleteUserGroupVars);

const { data, isPending, isSuccess, isError, error } = useUpdateSection(updateSectionVars);

const { data, isPending, isSuccess, isError, error } = useDeleteSection(deleteSectionVars);

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
import { createSection, createUserGroup, addUserToUserGroup, removeUserFromUserGroup, grantUserGroupToSectionForPurpose, revokeUserGroupFromSectionForPurpose, updateUserGroup, deleteUserGroup, updateSection, deleteSection } from '@dataconnect/generated';


// Operation CreateSection:  For variables, look at type CreateSectionVars in ../index.d.ts
const { data } = await CreateSection(dataConnect, createSectionVars);

// Operation CreateUserGroup:  For variables, look at type CreateUserGroupVars in ../index.d.ts
const { data } = await CreateUserGroup(dataConnect, createUserGroupVars);

// Operation AddUserToUserGroup:  For variables, look at type AddUserToUserGroupVars in ../index.d.ts
const { data } = await AddUserToUserGroup(dataConnect, addUserToUserGroupVars);

// Operation RemoveUserFromUserGroup:  For variables, look at type RemoveUserFromUserGroupVars in ../index.d.ts
const { data } = await RemoveUserFromUserGroup(dataConnect, removeUserFromUserGroupVars);

// Operation GrantUserGroupToSectionForPurpose:  For variables, look at type GrantUserGroupToSectionForPurposeVars in ../index.d.ts
const { data } = await GrantUserGroupToSectionForPurpose(dataConnect, grantUserGroupToSectionForPurposeVars);

// Operation RevokeUserGroupFromSectionForPurpose:  For variables, look at type RevokeUserGroupFromSectionForPurposeVars in ../index.d.ts
const { data } = await RevokeUserGroupFromSectionForPurpose(dataConnect, revokeUserGroupFromSectionForPurposeVars);

// Operation UpdateUserGroup:  For variables, look at type UpdateUserGroupVars in ../index.d.ts
const { data } = await UpdateUserGroup(dataConnect, updateUserGroupVars);

// Operation DeleteUserGroup:  For variables, look at type DeleteUserGroupVars in ../index.d.ts
const { data } = await DeleteUserGroup(dataConnect, deleteUserGroupVars);

// Operation UpdateSection:  For variables, look at type UpdateSectionVars in ../index.d.ts
const { data } = await UpdateSection(dataConnect, updateSectionVars);

// Operation DeleteSection:  For variables, look at type DeleteSectionVars in ../index.d.ts
const { data } = await DeleteSection(dataConnect, deleteSectionVars);


```