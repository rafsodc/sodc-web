# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateBookingDraft, useAddBookingLine, useUpdateBookingStatus, useCreateGuestTicketRequest, useAdminDeleteGuestTicketRequest, useAdminReviewGuestTicketRequest, useAdminDeleteBookingLine, useAdminDeleteBooking, useResolvePaymentReconciliationException, useGetCurrentUser } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateBookingDraft(createBookingDraftVars);

const { data, isPending, isSuccess, isError, error } = useAddBookingLine(addBookingLineVars);

const { data, isPending, isSuccess, isError, error } = useUpdateBookingStatus(updateBookingStatusVars);

const { data, isPending, isSuccess, isError, error } = useCreateGuestTicketRequest(createGuestTicketRequestVars);

const { data, isPending, isSuccess, isError, error } = useAdminDeleteGuestTicketRequest(adminDeleteGuestTicketRequestVars);

const { data, isPending, isSuccess, isError, error } = useAdminReviewGuestTicketRequest(adminReviewGuestTicketRequestVars);

const { data, isPending, isSuccess, isError, error } = useAdminDeleteBookingLine(adminDeleteBookingLineVars);

const { data, isPending, isSuccess, isError, error } = useAdminDeleteBooking(adminDeleteBookingVars);

const { data, isPending, isSuccess, isError, error } = useResolvePaymentReconciliationException(resolvePaymentReconciliationExceptionVars);

const { data, isPending, isSuccess, isError, error } = useGetCurrentUser();

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
import { createBookingDraft, addBookingLine, updateBookingStatus, createGuestTicketRequest, adminDeleteGuestTicketRequest, adminReviewGuestTicketRequest, adminDeleteBookingLine, adminDeleteBooking, resolvePaymentReconciliationException, getCurrentUser } from '@dataconnect/generated';


// Operation CreateBookingDraft:  For variables, look at type CreateBookingDraftVars in ../index.d.ts
const { data } = await CreateBookingDraft(dataConnect, createBookingDraftVars);

// Operation AddBookingLine:  For variables, look at type AddBookingLineVars in ../index.d.ts
const { data } = await AddBookingLine(dataConnect, addBookingLineVars);

// Operation UpdateBookingStatus:  For variables, look at type UpdateBookingStatusVars in ../index.d.ts
const { data } = await UpdateBookingStatus(dataConnect, updateBookingStatusVars);

// Operation CreateGuestTicketRequest:  For variables, look at type CreateGuestTicketRequestVars in ../index.d.ts
const { data } = await CreateGuestTicketRequest(dataConnect, createGuestTicketRequestVars);

// Operation AdminDeleteGuestTicketRequest:  For variables, look at type AdminDeleteGuestTicketRequestVars in ../index.d.ts
const { data } = await AdminDeleteGuestTicketRequest(dataConnect, adminDeleteGuestTicketRequestVars);

// Operation AdminReviewGuestTicketRequest:  For variables, look at type AdminReviewGuestTicketRequestVars in ../index.d.ts
const { data } = await AdminReviewGuestTicketRequest(dataConnect, adminReviewGuestTicketRequestVars);

// Operation AdminDeleteBookingLine:  For variables, look at type AdminDeleteBookingLineVars in ../index.d.ts
const { data } = await AdminDeleteBookingLine(dataConnect, adminDeleteBookingLineVars);

// Operation AdminDeleteBooking:  For variables, look at type AdminDeleteBookingVars in ../index.d.ts
const { data } = await AdminDeleteBooking(dataConnect, adminDeleteBookingVars);

// Operation ResolvePaymentReconciliationException:  For variables, look at type ResolvePaymentReconciliationExceptionVars in ../index.d.ts
const { data } = await ResolvePaymentReconciliationException(dataConnect, resolvePaymentReconciliationExceptionVars);

// Operation GetCurrentUser: 
const { data } = await GetCurrentUser(dataConnect);


```