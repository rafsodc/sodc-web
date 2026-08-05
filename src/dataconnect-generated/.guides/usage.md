# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useGetGovNotifyDeliveryConfiguration, useListGovNotifyDeliveryModeAudits, useCreateGovNotifyDeliveryConfiguration, useChangeGovNotifyDeliveryMode, useGetNotifyReplyToConfiguration, useListNotifyReplyToAudits, useCreateNotifyEmailConfiguration, useCreateNotifyReplyToAddress, useUpdateNotifyReplyToAddressIdentity, useRecordNotifyReplyToProviderAcceptance } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useGetGovNotifyDeliveryConfiguration();

const { data, isPending, isSuccess, isError, error } = useListGovNotifyDeliveryModeAudits(listGovNotifyDeliveryModeAuditsVars);

const { data, isPending, isSuccess, isError, error } = useCreateGovNotifyDeliveryConfiguration();

const { data, isPending, isSuccess, isError, error } = useChangeGovNotifyDeliveryMode(changeGovNotifyDeliveryModeVars);

const { data, isPending, isSuccess, isError, error } = useGetNotifyReplyToConfiguration();

const { data, isPending, isSuccess, isError, error } = useListNotifyReplyToAudits(listNotifyReplyToAuditsVars);

const { data, isPending, isSuccess, isError, error } = useCreateNotifyEmailConfiguration();

const { data, isPending, isSuccess, isError, error } = useCreateNotifyReplyToAddress(createNotifyReplyToAddressVars);

const { data, isPending, isSuccess, isError, error } = useUpdateNotifyReplyToAddressIdentity(updateNotifyReplyToAddressIdentityVars);

const { data, isPending, isSuccess, isError, error } = useRecordNotifyReplyToProviderAcceptance(recordNotifyReplyToProviderAcceptanceVars);

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
import { getGovNotifyDeliveryConfiguration, listGovNotifyDeliveryModeAudits, createGovNotifyDeliveryConfiguration, changeGovNotifyDeliveryMode, getNotifyReplyToConfiguration, listNotifyReplyToAudits, createNotifyEmailConfiguration, createNotifyReplyToAddress, updateNotifyReplyToAddressIdentity, recordNotifyReplyToProviderAcceptance } from '@dataconnect/generated';


// Operation GetGovNotifyDeliveryConfiguration: 
const { data } = await GetGovNotifyDeliveryConfiguration(dataConnect);

// Operation ListGovNotifyDeliveryModeAudits:  For variables, look at type ListGovNotifyDeliveryModeAuditsVars in ../index.d.ts
const { data } = await ListGovNotifyDeliveryModeAudits(dataConnect, listGovNotifyDeliveryModeAuditsVars);

// Operation CreateGovNotifyDeliveryConfiguration: 
const { data } = await CreateGovNotifyDeliveryConfiguration(dataConnect);

// Operation ChangeGovNotifyDeliveryMode:  For variables, look at type ChangeGovNotifyDeliveryModeVars in ../index.d.ts
const { data } = await ChangeGovNotifyDeliveryMode(dataConnect, changeGovNotifyDeliveryModeVars);

// Operation GetNotifyReplyToConfiguration: 
const { data } = await GetNotifyReplyToConfiguration(dataConnect);

// Operation ListNotifyReplyToAudits:  For variables, look at type ListNotifyReplyToAuditsVars in ../index.d.ts
const { data } = await ListNotifyReplyToAudits(dataConnect, listNotifyReplyToAuditsVars);

// Operation CreateNotifyEmailConfiguration: 
const { data } = await CreateNotifyEmailConfiguration(dataConnect);

// Operation CreateNotifyReplyToAddress:  For variables, look at type CreateNotifyReplyToAddressVars in ../index.d.ts
const { data } = await CreateNotifyReplyToAddress(dataConnect, createNotifyReplyToAddressVars);

// Operation UpdateNotifyReplyToAddressIdentity:  For variables, look at type UpdateNotifyReplyToAddressIdentityVars in ../index.d.ts
const { data } = await UpdateNotifyReplyToAddressIdentity(dataConnect, updateNotifyReplyToAddressIdentityVars);

// Operation RecordNotifyReplyToProviderAcceptance:  For variables, look at type RecordNotifyReplyToProviderAcceptanceVars in ../index.d.ts
const { data } = await RecordNotifyReplyToProviderAcceptance(dataConnect, recordNotifyReplyToProviderAcceptanceVars);


```