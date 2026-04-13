export function printDebug(meta: any) {
  console.log(`hello - ${meta?.fileName ?? "unknown"}`);

  console.log(JSON.stringify(meta.test, null, 2));
}
