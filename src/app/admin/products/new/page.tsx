import { PageHeader } from "@/components/ui/PageHeader";
import { ProductForm } from "../ProductForm";

export default function NewProduct() {
  return (
    <>
      <PageHeader title="Add product" />
      <ProductForm />
    </>
  );
}
