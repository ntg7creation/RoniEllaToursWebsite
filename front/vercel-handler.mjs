import { createRequestListener } from "@remix-run/node-fetch-server";
import { createRequestHandler } from "react-router";
import * as build from "./build/server/index.js";

// Vercel terminates TLS before Node. Preserve the public HTTPS origin so React
// Router's CSRF check accepts same-origin forms, including deployment URLs.
const handleRequest=createRequestHandler(build,"production");
export default createRequestListener(request=>handleRequest(request),{trustProxy:process.env.VERCEL === "1"});
