import { Button } from '@/components/ui/button'

export function Reserve() {
  return (
    <div className="lg:hidden sticky bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4 flex justify-between items-center z-40">
      <div className="flex flex-col">
        <div className="font-semibold text-foreground text-lg leading-tight">
          $150 <span className="text-base font-normal text-foreground/80">noche</span>
        </div>
        <p className="text-sm text-foreground underline font-medium mt-0.5">12 – 17 oct</p>
      </div>
      <Button className="w-auto px-10 rounded-lg font-semibold text-base py-6 bg-[#E31C5F] hover:bg-[#D70466] text-white h-auto">
        Reservar
      </Button>
    </div>
  )
}
