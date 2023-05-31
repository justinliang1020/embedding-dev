'use client';
import { useState, FormEvent, ChangeEvent } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
type FormData = {
    text: string;
    title: string;
}
export default function AddCollectionPage() {
    const { register, handleSubmit, watch, } = useForm<FormData>();
    const onSubmit: SubmitHandler<FormData> = async (data) => {
        await fetch("api/addCollection", {
            method: "POST",
            body: JSON.stringify({
                text: data.text,
                title: data.title
            }
            )
        })
    } 

    return (
        <main className="flex min-h-screen flex-col items-center space-y-5 p-24">
            <div>
                <h1>Add Collection Page</h1>
            </div>
            <form className="flex flex-col space-y-10" onSubmit={handleSubmit(onSubmit)}>
                <input type="text" {...register("title", {required: true})} className="border-gray-900 border-2"/>
                <textarea {...register("text", { required: true })} className="border-gray-900 border-2" > 
                </textarea>
                <button>submit</button>
            </form>
        </main>
    )
}