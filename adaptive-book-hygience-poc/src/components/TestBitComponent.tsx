import { Footer }  from "@pratikp72/design-system.ui";
import DaysFilters  from "@pratikp72/design-system.days-filters";

export default function Test() {
  return (
    <div>
      <DaysFilters
        value={24}
        onChange={(value: any) => console.log(value)}
        disabled={false}/>

      <Footer/>

      </div>
      
      );

}