// app/page.tsx
import GeneratorForm from '@/components/features/GeneratorForm';

export default function Home() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center text-center pb-20">
      {/* Updated: Dark gray heading */}
      <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
        Create Course Messages
      </h1>
      {/* Updated: Medium gray paragraph text */}
      <p className="mt-6 mb-6 max-w-3xl text-lg text-black from-neutral-950">
        Paste your course link below to instantly generate engaging, promotional messages using AI.
      </p>

      <GeneratorForm />

    </div>
  );
}