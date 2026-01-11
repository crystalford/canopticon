import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <SignUp 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton: "bg-white/[0.05] border border-white/10 text-white hover:bg-white/[0.1]",
              formButtonPrimary: "bg-white text-black hover:bg-gray-200",
              formFieldInput: "bg-white/[0.05] border-white/10 text-white",
              formFieldLabel: "text-gray-400",
              footerActionLink: "text-cyan-400 hover:text-cyan-300",
            }
          }}
        />
      </div>
    </div>
  )
}
