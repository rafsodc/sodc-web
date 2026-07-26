# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreatePendingSectionFile, useGetSectionFileById, useListSectionFilesByStatus, useFinalizePendingSectionFile, useUpdateAvailableSectionFileMetadata, useBeginSectionFileReplacement, useFinalizeSectionFileReplacement, useAbortSectionFileReplacement, useBeginSectionFileDeletion, useMarkSectionFileDeleted } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreatePendingSectionFile(createPendingSectionFileVars);

const { data, isPending, isSuccess, isError, error } = useGetSectionFileById(getSectionFileByIdVars);

const { data, isPending, isSuccess, isError, error } = useListSectionFilesByStatus(listSectionFilesByStatusVars);

const { data, isPending, isSuccess, isError, error } = useFinalizePendingSectionFile(finalizePendingSectionFileVars);

const { data, isPending, isSuccess, isError, error } = useUpdateAvailableSectionFileMetadata(updateAvailableSectionFileMetadataVars);

const { data, isPending, isSuccess, isError, error } = useBeginSectionFileReplacement(beginSectionFileReplacementVars);

const { data, isPending, isSuccess, isError, error } = useFinalizeSectionFileReplacement(finalizeSectionFileReplacementVars);

const { data, isPending, isSuccess, isError, error } = useAbortSectionFileReplacement(abortSectionFileReplacementVars);

const { data, isPending, isSuccess, isError, error } = useBeginSectionFileDeletion(beginSectionFileDeletionVars);

const { data, isPending, isSuccess, isError, error } = useMarkSectionFileDeleted(markSectionFileDeletedVars);

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
import { createPendingSectionFile, getSectionFileById, listSectionFilesByStatus, finalizePendingSectionFile, updateAvailableSectionFileMetadata, beginSectionFileReplacement, finalizeSectionFileReplacement, abortSectionFileReplacement, beginSectionFileDeletion, markSectionFileDeleted } from '@dataconnect/generated';


// Operation CreatePendingSectionFile:  For variables, look at type CreatePendingSectionFileVars in ../index.d.ts
const { data } = await CreatePendingSectionFile(dataConnect, createPendingSectionFileVars);

// Operation GetSectionFileById:  For variables, look at type GetSectionFileByIdVars in ../index.d.ts
const { data } = await GetSectionFileById(dataConnect, getSectionFileByIdVars);

// Operation ListSectionFilesByStatus:  For variables, look at type ListSectionFilesByStatusVars in ../index.d.ts
const { data } = await ListSectionFilesByStatus(dataConnect, listSectionFilesByStatusVars);

// Operation FinalizePendingSectionFile:  For variables, look at type FinalizePendingSectionFileVars in ../index.d.ts
const { data } = await FinalizePendingSectionFile(dataConnect, finalizePendingSectionFileVars);

// Operation UpdateAvailableSectionFileMetadata:  For variables, look at type UpdateAvailableSectionFileMetadataVars in ../index.d.ts
const { data } = await UpdateAvailableSectionFileMetadata(dataConnect, updateAvailableSectionFileMetadataVars);

// Operation BeginSectionFileReplacement:  For variables, look at type BeginSectionFileReplacementVars in ../index.d.ts
const { data } = await BeginSectionFileReplacement(dataConnect, beginSectionFileReplacementVars);

// Operation FinalizeSectionFileReplacement:  For variables, look at type FinalizeSectionFileReplacementVars in ../index.d.ts
const { data } = await FinalizeSectionFileReplacement(dataConnect, finalizeSectionFileReplacementVars);

// Operation AbortSectionFileReplacement:  For variables, look at type AbortSectionFileReplacementVars in ../index.d.ts
const { data } = await AbortSectionFileReplacement(dataConnect, abortSectionFileReplacementVars);

// Operation BeginSectionFileDeletion:  For variables, look at type BeginSectionFileDeletionVars in ../index.d.ts
const { data } = await BeginSectionFileDeletion(dataConnect, beginSectionFileDeletionVars);

// Operation MarkSectionFileDeleted:  For variables, look at type MarkSectionFileDeletedVars in ../index.d.ts
const { data } = await MarkSectionFileDeleted(dataConnect, markSectionFileDeletedVars);


```