import TaskList from '../features/tasks/components/TaskList'
import { useAuthStore } from '../features/auth/authStore'
import { getTasksByUser } from '../features/tasks/taskSelectors'
import { useTaskStore } from '../features/tasks/taskStore'

function UserTasks() {
  const { currentUser } = useAuthStore()
  const { tasks, updateTask } = useTaskStore()

  const visibleTasks =
    currentUser.role === 'user'
      ? getTasksByUser(tasks, currentUser.id, currentUser.name)
      : tasks

  return (
    <section className="page-card role-page-shell">
      <header className="role-page-header">
        <h2>{currentUser.role === 'user' ? 'Moji zadaci' : 'Zadaci'}</h2>
        <p>
          {currentUser.role === 'user'
            ? 'Operativni pregled zadataka dodeljenih tebi.'
            : 'Pregled taskova u ovoj mock fazi.'}
        </p>
      </header>

      <TaskList tasks={visibleTasks} onTaskChange={updateTask} />
    </section>
  )
}

export default UserTasks