export async function createNativeRenderer(...args:Parameters<typeof import('./native-renderer').createRenderer>){
 const {createRenderer}=await import('./native-renderer');
 return createRenderer(...args);
}
