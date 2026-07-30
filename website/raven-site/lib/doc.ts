import { ravenDoc } from "@/basic-doc";
import { DocSchema } from "./types";

export const getDocSchema = async (): Promise<DocSchema> => {
  return ravenDoc;
};

export const allDocItems = async () => {
  const schema = await getDocSchema();
  return schema.flatMap((section) => section.items);
};

export const getDoc = async (id: string) => {
  const allItems = await allDocItems();
  return allItems.find((item) => item.id === id);
};
