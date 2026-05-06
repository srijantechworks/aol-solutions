export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-20 text-neutral-800">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-6">About Srijan</h1>
        <p className="text-lg md:text-xl text-neutral-600">
          Empowering The Art of Living Foundation teachers with AI-driven tools.
        </p>
      </div>

      <div className="space-y-12 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">Our Vision</h2>
          <p className="mb-4">
            Our vision is to empower The Art of Living Foundation teachers with AI-driven tools that simplify outreach, support course promotion, and make communication feel authentic and effortless.
          </p>
          <p>
            By combining advanced AI technology with the spirit of service, we aim to build practical, user-friendly solutions that help teachers save time, connect meaningfully with people, and focus more on creating impact through their programs and initiatives.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">Why We Built This</h2>
          <p className="mb-4">
            Teachers and volunteers at The Art of Living Foundation dedicate their time and energy to transforming lives through programs, service, and human connection. However, promoting courses and creating communication content — emails, social posts, and event updates — often takes significant time and effort.
          </p>
          <p className="mb-4 font-semibold text-neutral-900">
            We built Srijan to simplify this process.
          </p>
          <p className="mb-4">
            Srijan is an AI-powered assistant that helps create personalized promotional content and communication materials directly from course links and event information. Our goal is to reduce repetitive effort so organizers and volunteers can focus more on conducting programs, connecting with people, and spreading knowledge.
          </p>
          <p>
            Built with deep understanding of community outreach and modern technology, Srijan is designed to be simple, practical, and aligned with the spirit of service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">About Us</h2>
          <p className="mb-4">
            Srijan is built by a team with strong experience in technology, AI, and digital products, along with a long-standing connection to the The Art of Living Foundation community.
          </p>
          <p>
            With backgrounds spanning software engineering, artificial intelligence, product thinking, and global exposure, the team is focused on building practical AI-powered tools that help teachers and volunteers simplify outreach, promote programs more effectively, and save valuable time.
          </p>
        </section>
      </div>

      <div className="mt-16 pt-8 border-t border-neutral-300 text-sm text-neutral-500 italic">
        <p>
          *Disclaimer: Srijan is an independent technology initiative created to support teachers and volunteers through AI-powered communication tools. References to The Art of Living Foundation are made only to describe the community the platform is designed to serve.
        </p>
      </div>
    </div>
  );
}
