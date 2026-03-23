const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'
const buildStamp = process.env.NEXT_PUBLIC_BUILD_STAMP || 'local build'

type AppBuildInfoProps = {
  className?: string
}

export function AppBuildInfo({ className = '' }: AppBuildInfoProps) {
  return (
    <div className={`text-xs text-gray-500 ${className}`.trim()}>
      <span>Version {appVersion}</span>
      <span className="mx-2 text-gray-300">|</span>
      <span>{buildStamp}</span>
    </div>
  )
}
