const controllers=new Map();
export function registerWorkflow(id,controller){controllers.set(String(id),controller)}
export function unregisterWorkflow(id){controllers.delete(String(id))}
export function cancelWorkflow(id){const c=controllers.get(String(id));if(!c)return false;c.abort("cancelled-by-user");return true;}
