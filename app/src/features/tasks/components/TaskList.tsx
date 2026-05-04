import TaskCard from './TaskCard'
import type { Task } from '../types'

export interface TaskListProps {
  tasks: Task[]
  onTaskChange?: (task: Task) => void
}

function TaskList({ tasks, onTaskChange }: TaskListProps) {
  if (!tasks.length) {
    return <div className="customer-task-empty">Nema taskova</div>
  }

  const sortedTasks = tasks.slice().sort((first, second) => {
    const firstOrder = first.sequenceOrder ?? 9999
    const secondOrder = second.sequenceOrder ?? 9999
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
    return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
  })

  return (
    <div className="customer-task-list">
      {sortedTasks.map((task) => (
        <TaskCard key={task.id} task={task} onTaskChange={onTaskChange} />
      ))}
    </div>
  )
}

export default TaskList
