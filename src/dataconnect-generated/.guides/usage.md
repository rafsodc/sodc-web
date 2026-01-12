# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useGetCurrentUser, useGetUserById, useListUsers, useListSections, useGetSectionsForUser, useListAccessGroups, useGetUserAccessGroups, useCheckUserProfileExists, useGetUserMembershipStatus, useGetUserWithAccessGroups } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useGetCurrentUser();

const { data, isPending, isSuccess, isError, error } = useGetUserById(getUserByIdVars);

const { data, isPending, isSuccess, isError, error } = useListUsers();

const { data, isPending, isSuccess, isError, error } = useListSections();

const { data, isPending, isSuccess, isError, error } = useGetSectionsForUser();

const { data, isPending, isSuccess, isError, error } = useListAccessGroups();

const { data, isPending, isSuccess, isError, error } = useGetUserAccessGroups();

const { data, isPending, isSuccess, isError, error } = useCheckUserProfileExists();

const { data, isPending, isSuccess, isError, error } = useGetUserMembershipStatus(getUserMembershipStatusVars);

const { data, isPending, isSuccess, isError, error } = useGetUserWithAccessGroups(getUserWithAccessGroupsVars);

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
import { getCurrentUser, getUserById, listUsers, listSections, getSectionsForUser, listAccessGroups, getUserAccessGroups, checkUserProfileExists, getUserMembershipStatus, getUserWithAccessGroups } from '@dataconnect/generated';


// Operation GetCurrentUser: 
const { data } = await GetCurrentUser(dataConnect);

// Operation GetUserById:  For variables, look at type GetUserByIdVars in ../index.d.ts
const { data } = await GetUserById(dataConnect, getUserByIdVars);

// Operation ListUsers: 
const { data } = await ListUsers(dataConnect);

// Operation ListSections: 
const { data } = await ListSections(dataConnect);

// Operation GetSectionsForUser: 
const { data } = await GetSectionsForUser(dataConnect);

// Operation ListAccessGroups: 
const { data } = await ListAccessGroups(dataConnect);

// Operation GetUserAccessGroups: 
const { data } = await GetUserAccessGroups(dataConnect);

// Operation CheckUserProfileExists: 
const { data } = await CheckUserProfileExists(dataConnect);

// Operation GetUserMembershipStatus:  For variables, look at type GetUserMembershipStatusVars in ../index.d.ts
const { data } = await GetUserMembershipStatus(dataConnect, getUserMembershipStatusVars);

// Operation GetUserWithAccessGroups:  For variables, look at type GetUserWithAccessGroupsVars in ../index.d.ts
const { data } = await GetUserWithAccessGroups(dataConnect, getUserWithAccessGroupsVars);


```