import { loadCaseStudyData } from "../lib/data";
import { AtlasExperience } from "../components/atlas-experience";

export default async function Page() {
  const data = await loadCaseStudyData();
  return <AtlasExperience {...data} />;
}
