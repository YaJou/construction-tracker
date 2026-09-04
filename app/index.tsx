import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projects"); // редирект на страницу проектов
  }, [router]);

  return null; // ничего не показываем, просто редирект
}