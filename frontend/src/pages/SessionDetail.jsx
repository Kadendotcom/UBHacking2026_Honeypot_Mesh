import { useParams, Link } from 'react-router'

export default function SessionDetail() {
  const { id } = useParams()

  return (
    <div>
      <Link to="/transmissions" className="text-sm text-muted-foreground hover:text-foreground">
        ← All signals
      </Link>
      <h1 className="mt-4 font-display text-4xl italic">Session {id}</h1>
    </div>
  )
}