/**
 * API 集成到 Zustand Store
 *
 * 这一层负责将后端 API 调用集成到状态管理中
 */

import { scenesApi, simulationsApi, SimulationWebSocket, MessageType } from '../api'
import type { Scene, Simulation, SimulationParameters } from '../types'
import type { PhysisStore } from './index'


/**
 * API Actions 定义
 */
export interface ApiActions {
  // 场景管理
  loadScenes: () => Promise<void>
  loadScene: (sceneId: string) => Promise<Scene | null>

  // 仿真管理
  createSimulation: (sceneId: string, parameters?: Partial<SimulationParameters>) => Promise<string | null>
  startSimulation: () => Promise<void>
  pauseSimulation: () => Promise<void>
  resumeSimulation: () => Promise<void>
  resetSimulation: () => Promise<void>
  updateSimulationParameters: (parameters: Partial<SimulationParameters>) => Promise<void>

  // WebSocket 管理
  connectWebSocket: () => void
  disconnectWebSocket: () => void
}


/**
 * 创建 API Actions
 */
export const createApiActions = (
  set: PhysisStore['setState'],
  get: PhysisStore['getState'],
): ApiActions => ({
  // ============================================
  // 场景管理
  // ============================================

  /**
   * 加载所有场景
   */
  loadScenes: async () => {
    try {
      const scenes = await scenesApi.list()
      set({ scenes })
    } catch (error) {
      console.error('Failed to load scenes:', error)
      get().addNotification({
        type: 'error',
        title: '加载场景失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
    }
  },

  /**
   * 加载单个场景详情
   */
  loadScene: async (sceneId: string) => {
    try {
      const scene = await scenesApi.get(sceneId)
      set({ currentScene: scene })
      return scene
    } catch (error) {
      console.error(`Failed to load scene ${sceneId}:`, error)
      get().addNotification({
        type: 'error',
        title: '加载场景失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
      return null
    }
  },

  // ============================================
  // 仿真管理
  // ============================================

  /**
   * 创建仿真会话
   */
  createSimulation: async (sceneId, parameters) => {
    try {
      const simulation = await simulationsApi.create({
        scene_id: sceneId,
        parameters: parameters as Record<string, unknown>,
      })

      set({
        simulationId: simulation.id,
        simulationState: simulation.state,
        currentSceneId: sceneId,
      })

      // 启动仿真
      await simulationsApi.start(simulation.id)

      return simulation.id
    } catch (error) {
      console.error('Failed to create simulation:', error)
      get().addNotification({
        type: 'error',
        title: '创建仿真失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
      return null
    }
  },

  /**
   * 启动仿真
   */
  startSimulation: async () => {
    const { simulationId } = get()
    if (!simulationId) return

    try {
      const result = await simulationsApi.start(simulationId)
      set({
        simulationStatus: result.status,
      })
    } catch (error) {
      console.error('Failed to start simulation:', error)
      get().addNotification({
        type: 'error',
        title: '启动仿真失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
    }
  },

  /**
   * 暂停仿真
   */
  pauseSimulation: async () => {
    const { simulationId } = get()
    if (!simulationId) return

    try {
      const result = await simulationsApi.pause(simulationId)
      set({
        simulationStatus: result.status,
      })
    } catch (error) {
      console.error('Failed to pause simulation:', error)
      get().addNotification({
        type: 'error',
        title: '暂停仿真失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
    }
  },

  /**
   * 继续仿真
   */
  resumeSimulation: async () => {
    const { simulationId } = get()
    if (!simulationId) return

    try {
      const result = await simulationsApi.resume(simulationId)
      set({
        simulationStatus: result.status,
      })
    } catch (error) {
      console.error('Failed to resume simulation:', error)
      get().addNotification({
        type: 'error',
        title: '继续仿真失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
    }
  },

  /**
   * 重置仿真
   */
  resetSimulation: async () => {
    const { simulationId } = get()
    if (!simulationId) return

    try {
      const result = await simulationsApi.reset(simulationId)
      set({
        simulationStatus: result.status,
        simulationTime: 0,
        simulationProgress: 0,
      })
    } catch (error) {
      console.error('Failed to reset simulation:', error)
      get().addNotification({
        type: 'error',
        title: '重置仿真失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
    }
  },

  /**
   * 更新仿真参数
   */
  updateSimulationParameters: async (parameters) => {
    const { simulationId } = get()
    if (!simulationId) return

    try {
      await simulationsApi.updateParameters(simulationId, parameters)
      set((state) => ({
        simulationParameters: {
          ...state.simulationParameters,
          ...parameters,
        },
      }))
    } catch (error) {
      console.error('Failed to update parameters:', error)
      get().addNotification({
        type: 'error',
        title: '更新参数失败',
        message: error instanceof Error ? error.message : '未知错误',
      })
    }
  },

  // ============================================
  // WebSocket 管理
  // ============================================

  /**
   * 连接 WebSocket
   */
  connectWebSocket: () => {
    const { simulationId, disconnectWebSocket } = get()

    // 断开旧连接
    disconnectWebSocket()

    if (!simulationId) return

    const ws = new SimulationWebSocket({
      simulationId,
      onMessage: (message) => {
        const { handleWebSocketMessage } = get()
        handleWebSocketMessage(message)
      },
      onError: (event) => {
        console.error('WebSocket error:', event)
        get().addNotification({
          type: 'error',
          title: '连接错误',
          message: 'WebSocket 连接发生错误',
        })
      },
      onClose: () => {
        set({ wsConnected: false })
      },
      onOpen: () => {
        set({ wsConnected: true })
      },
    })

    ws.connect()
    set({ webSocket: ws })
  },

  /**
   * 断开 WebSocket
   */
  disconnectWebSocket: () => {
    const { webSocket } = get()
    if (webSocket) {
      webSocket.disconnect()
      set({ webSocket: null, wsConnected: false })
    }
  },
})
