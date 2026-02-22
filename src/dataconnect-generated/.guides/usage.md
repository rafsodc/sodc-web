# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateSection, useCreateAccessGroup, useAddUserToAccessGroup, useRemoveUserFromAccessGroup, useGrantViewAccessGroupToSection, useRevokeViewAccessGroupFromSection, useGrantMemberAccessGroupToSection, useRevokeMemberAccessGroupFromSection, useUpdateAccessGroup, useDeleteAccessGroup } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateSection(createSectionVars);

const { data, isPending, isSuccess, isError, error } = useCreateAccessGroup(createAccessGroupVars);

const { data, isPending, isSuccess, isError, error } = useAddUserToAccessGroup(addUserToAccessGroupVars);

const { data, isPending, isSuccess, isError, error } = useRemoveUserFromAccessGroup(removeUserFromAccessGroupVars);

const { data, isPending, isSuccess, isError, error } = useGrantViewAccessGroupToSection(grantViewAccessGroupToSectionVars);

const { data, isPending, isSuccess, isError, error } = useRevokeViewAccessGroupFromSection(revokeViewAccessGroupFromSectionVars);

const { data, isPending, isSuccess, isError, error } = useGrantMemberAccessGroupToSection(grantMemberAccessGroupToSectionVars);

const { data, isPending, isSuccess, isError, error } = useRevokeMemberAccessGroupFromSection(revokeMemberAccessGroupFromSectionVars);

const { data, isPending, isSuccess, isError, error } = useUpdateAccessGroup(updateAccessGroupVars);

const { data, isPending, isSuccess, isError, error } = useDeleteAccessGroup(deleteAccessGroupVars);

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
import { createSection, createAccessGroup, addUserToAccessGroup, removeUserFromAccessGroup, grantViewAccessGroupToSection, revokeViewAccessGroupFromSection, grantMemberAccessGroupToSection, revokeMemberAccessGroupFromSection, updateAccessGroup, deleteAccessGroup } from '@dataconnect/generated';


// Operation CreateSection:  For variables, look at type CreateSectionVars in ../index.d.ts
const { data } = await CreateSection(dataConnect, createSectionVars);

// Operation CreateAccessGroup:  For variables, look at type CreateAccessGroupVars in ../index.d.ts
const { data } = await CreateAccessGroup(dataConnect, createAccessGroupVars);

// Operation AddUserToAccessGroup:  For variables, look at type AddUserToAccessGroupVars in ../index.d.ts
const { data } = await AddUserToAccessGroup(dataConnect, addUserToAccessGroupVars);

// Operation RemoveUserFromAccessGroup:  For variables, look at type RemoveUserFromAccessGroupVars in ../index.d.ts
const { data } = await RemoveUserFromAccessGroup(dataConnect, removeUserFromAccessGroupVars);

// Operation GrantViewAccessGroupToSection:  For variables, look at type GrantViewAccessGroupToSectionVars in ../index.d.ts
const { data } = await GrantViewAccessGroupToSection(dataConnect, grantViewAccessGroupToSectionVars);

// Operation RevokeViewAccessGroupFromSection:  For variables, look at type RevokeViewAccessGroupFromSectionVars in ../index.d.ts
const { data } = await RevokeViewAccessGroupFromSection(dataConnect, revokeViewAccessGroupFromSectionVars);

// Operation GrantMemberAccessGroupToSection:  For variables, look at type GrantMemberAccessGroupToSectionVars in ../index.d.ts
const { data } = await GrantMemberAccessGroupToSection(dataConnect, grantMemberAccessGroupToSectionVars);

// Operation RevokeMemberAccessGroupFromSection:  For variables, look at type RevokeMemberAccessGroupFromSectionVars in ../index.d.ts
const { data } = await RevokeMemberAccessGroupFromSection(dataConnect, revokeMemberAccessGroupFromSectionVars);

// Operation UpdateAccessGroup:  For variables, look at type UpdateAccessGroupVars in ../index.d.ts
const { data } = await UpdateAccessGroup(dataConnect, updateAccessGroupVars);

// Operation DeleteAccessGroup:  For variables, look at type DeleteAccessGroupVars in ../index.d.ts
const { data } = await DeleteAccessGroup(dataConnect, deleteAccessGroupVars);


```