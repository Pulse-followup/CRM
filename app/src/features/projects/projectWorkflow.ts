import { getActiveTasks, getTasksByStage } from '../tasks/taskSelectors'
import type { Task } from '../tasks/types'
import { getProjectProgress } from './projectLifecycle'
import type { Project } from './types'

export interface ProjectStageProgressItem {
  stageId: string
  totalTasks: number
  completedTasks: number
  activeTasks: number
}

export function getProjectStageProgress(project: Project, tasks: Task[]): ProjectStageProgressItem[] {
  if (!project.stages?.length) {
    return []
  }

  return project.stages
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((stage) => {
      const stageTasks = getTasksByStage(tasks, stage.id)
      const progress = getProjectProgress(stageTasks)

      return {
        stageId: stage.id,
        totalTasks: progress.totalTasks,
        completedTasks: progress.completedTasks,
        activeTasks: getActiveTasks(stageTasks).length,
      }
    })
}
