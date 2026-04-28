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

  return (
    <div className="customer-task-list">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onTaskChange={onTaskChange} />
      ))}
    </div>
  )
}

export default TaskList
