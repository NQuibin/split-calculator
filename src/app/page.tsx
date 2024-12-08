"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { X } from "lucide-react";

type Item = {
  cost: number;
  discount: number;
  tax: number;
  splitBy: number;
  total: number;
};

const formSchema = z.object({
  cost: z.coerce
    .number({ errorMap: () => ({ message: "Must be a positive value" }) })
    .positive(),
  discount: z.coerce.number().min(0),
  tax: z.coerce.number().min(0),
  splitBy: z.coerce.number().int().min(1),
});

export default function Home() {
  const [currentItems, setCurrentItems] = useState<Array<Item>>([]);
  const [total, setTotal] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cost: "" as unknown as number,
      discount: "" as unknown as number,
      tax: "" as unknown as number,
      splitBy: 1,
    },
  });

  const handleAddItem = (values: z.infer<typeof formSchema>) => {
    const { cost, discount, tax, splitBy } = values;
    const itemTotal = ((cost - discount) * (1 + tax / 100)) / splitBy;

    const item: Item = {
      cost,
      discount,
      tax,
      splitBy,
      total: itemTotal,
    };

    setTotal(total + itemTotal);
    setCurrentItems([...currentItems, item]);

    form.reset();
  };

  const handleRemoveItem = (index: number) => {
    const itemToBeRemoved = currentItems[index];
    setTotal(total - itemToBeRemoved.total);

    setCurrentItems([
      ...currentItems.slice(0, index),
      ...currentItems.slice(index + 1),
    ]);
  };

  const handleRestart = () => {
    form.reset();
    setCurrentItems([]);
    setTotal(0);
  };

  return (
    <div className="p-5 max-w-lg mx-auto rounded-md sm:my-5 sm:border sm:border-solid">
      <h1 className="mb-4 font-semibold text-xl">Split Calculator</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleAddItem)}>
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem className="mb-2">
                <FormLabel>Cost</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discount"
            render={({ field }) => (
              <FormItem className="mb-2">
                <FormLabel>Discount</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tax"
            render={({ field }) => (
              <FormItem className="mb-2">
                <FormLabel>Tax (%)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <Button
            type="button"
            className="mb-2"
            onClick={() => {
              form.setValue("tax", 13);
              form.setFocus("tax");
            }}
          >
            13%
          </Button>
          <FormField
            control={form.control}
            name="splitBy"
            render={({ field }) => (
              <FormItem className="mb-2">
                <FormLabel>Split By</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <Button
            type="button"
            className="mb-2"
            onClick={() => {
              form.setValue("splitBy", 2);
              form.setFocus("splitBy");
            }}
          >
            2
          </Button>
          <div className="flex gap-x-2 justify-end">
            <Button type="submit" className="mt-2 mb-4">
              Add item
            </Button>
          </div>
        </form>
      </Form>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell colSpan={5} className="font-semibold">
                Total
              </TableCell>
              <TableCell className="font-semibold">
                {total.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableHeader>
            <TableRow>
              <TableHead>Cost</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Tax (%)</TableHead>
              <TableHead>Split By</TableHead>
              <TableHead>Total ($)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.cost}</TableCell>
                <TableCell>{item.discount.toFixed(2)}</TableCell>
                <TableCell>{item.tax}%</TableCell>
                <TableCell>{item.splitBy}</TableCell>
                <TableCell>{item.total.toFixed(2)}</TableCell>
                <TableCell>
                  <div
                    className="flex justify-center cursor-pointer"
                    onClick={() => handleRemoveItem(index)}
                  >
                    <X size={16} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="w-full flex justify-end">
          <Button
            variant="destructive"
            type="button"
            className="mt-4"
            disabled={!currentItems.length}
            onClick={handleRestart}
          >
            Restart
          </Button>
        </div>
      </div>
    </div>
  );
}
