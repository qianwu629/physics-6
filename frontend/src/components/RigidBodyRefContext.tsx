import { createContext, useContext } from 'react';

/** 共享 RigidBody ref 注册表，让 SpringRenderer 能获取其他 Entity 的物理体引用 */
export const RigidBodyRefContext = createContext<{
  register: (entityId: string, ref: any) => void;
  unregister: (entityId: string) => void;
  getRef: (entityId: string) => any | undefined;
}>({
  register: () => {},
  unregister: () => {},
  getRef: () => undefined,
});

export function useRigidBodyRefRegistry() {
  return useContext(RigidBodyRefContext);
}
