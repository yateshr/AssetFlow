import { ActivityIndicator } from "@/components/ui/loading"

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <ActivityIndicator
      label="Loading"
      className={className}
      {...props}
    />
  )
}

export { Spinner }
