export default function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  )
}