// app/about/page.tsx
export default function AboutPage() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-bold text-neutral-100">About This Project</h1>
      <p className="mt-4 max-w-2xl text-neutral-400">
        This tool uses AI and web scraping to generate beautiful, customized 
        promotional messages for upcoming courses.
      </p>
    </div>
  );
}