# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useGetGovNotifyDeliveryConfiguration, useListGovNotifyDeliveryModeAudits, useCreateGovNotifyDeliveryConfiguration, useChangeGovNotifyDeliveryMode, useCreatePendingSectionFile, useGetSectionFileById, useListSectionFilesByStatus, useListStaleSectionFiles, useListSectionFilesForQuota, useRecordSectionFileAudit } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useGetGovNotifyDeliveryConfiguration();

const { data, isPending, isSuccess, isError, error } = useListGovNotifyDeliveryModeAudits(listGovNotifyDeliveryModeAuditsVars);

const { data, isPending, isSuccess, isError, error } = useCreateGovNotifyDeliveryConfiguration();

const { data, isPending, isSuccess, isError, error } = useChangeGovNotifyDeliveryMode(changeGovNotifyDeliveryModeVars);

const { data, isPending, isSuccess, isError, error } = useCreatePendingSectionFile(createPendingSectionFileVars);

const { data, isPending, isSuccess, isError, error } = useGetSectionFileById(getSectionFileByIdVars);

const { data, isPending, isSuccess, isError, error } = useListSectionFilesByStatus(listSectionFilesByStatusVars);

const { data, isPending, isSuccess, isError, error } = useListStaleSectionFiles(listStaleSectionFilesVars);

const { data, isPending, isSuccess, isError, error } = useListSectionFilesForQuota(listSectionFilesForQuotaVars);

const { data, isPending, isSuccess, isError, error } = useRecordSectionFileAudit(recordSectionFileAuditVars);

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
import { getGovNotifyDeliveryConfiguration, listGovNotifyDeliveryModeAudits, createGovNotifyDeliveryConfiguration, changeGovNotifyDeliveryMode, createPendingSectionFile, getSectionFileById, listSectionFilesByStatus, listStaleSectionFiles, listSectionFilesForQuota, recordSectionFileAudit } from '@dataconnect/generated';


// Operation GetGovNotifyDeliveryConfiguration: 
const { data } = await GetGovNotifyDeliveryConfiguration(dataConnect);

// Operation ListGovNotifyDeliveryModeAudits:  For variables, look at type ListGovNotifyDeliveryModeAuditsVars in ../index.d.ts
const { data } = await ListGovNotifyDeliveryModeAudits(dataConnect, listGovNotifyDeliveryModeAuditsVars);

// Operation CreateGovNotifyDeliveryConfiguration: 
const { data } = await CreateGovNotifyDeliveryConfiguration(dataConnect);

// Operation ChangeGovNotifyDeliveryMode:  For variables, look at type ChangeGovNotifyDeliveryModeVars in ../index.d.ts
const { data } = await ChangeGovNotifyDeliveryMode(dataConnect, changeGovNotifyDeliveryModeVars);

// Operation CreatePendingSectionFile:  For variables, look at type CreatePendingSectionFileVars in ../index.d.ts
const { data } = await CreatePendingSectionFile(dataConnect, createPendingSectionFileVars);

// Operation GetSectionFileById:  For variables, look at type GetSectionFileByIdVars in ../index.d.ts
const { data } = await GetSectionFileById(dataConnect, getSectionFileByIdVars);

// Operation ListSectionFilesByStatus:  For variables, look at type ListSectionFilesByStatusVars in ../index.d.ts
const { data } = await ListSectionFilesByStatus(dataConnect, listSectionFilesByStatusVars);

// Operation ListStaleSectionFiles:  For variables, look at type ListStaleSectionFilesVars in ../index.d.ts
const { data } = await ListStaleSectionFiles(dataConnect, listStaleSectionFilesVars);

// Operation ListSectionFilesForQuota:  For variables, look at type ListSectionFilesForQuotaVars in ../index.d.ts
const { data } = await ListSectionFilesForQuota(dataConnect, listSectionFilesForQuotaVars);

// Operation RecordSectionFileAudit:  For variables, look at type RecordSectionFileAuditVars in ../index.d.ts
const { data } = await RecordSectionFileAudit(dataConnect, recordSectionFileAuditVars);


```