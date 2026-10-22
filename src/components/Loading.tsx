// Shown for the moment between server render and reading answers from this device.
export function Loading() {
  return (
    <>
      <div className="skeleton" aria-hidden="true" />
      <p className="visually-hidden" role="status">
        Loading your answers
      </p>
    </>
  );
}
