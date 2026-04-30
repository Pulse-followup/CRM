import { useAuthStore } from '../features/auth/authStore'

function ProjectsPage() {
  const { currentUser } = useAuthStore()

  return (
    <section className="page-card">
      <h2>{currentUser.role === 'user' ? 'Moji projekti' : 'Projekti'}</h2>
    </section>
  )
}

export default ProjectsPage
