import { toast } from '@/components/ui/use-toast'

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const variant = type === 'error' ? 'destructive' : 'default'
  
  toast({
    title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info',
    description: message,
    variant,
  })
}

