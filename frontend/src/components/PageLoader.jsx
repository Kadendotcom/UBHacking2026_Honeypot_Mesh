import lower from '@/assets/lower.svg'
import upper from '@/assets/upper.svg'

export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading page">
      <div className="page-loader__icon" aria-hidden="true">
        <img className="page-loader__rotating" src={lower} alt="" />
        <img className="page-loader__static" src={upper} alt="" />
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  )
}
