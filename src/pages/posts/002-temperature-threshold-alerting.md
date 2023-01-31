---
layout: "../../layouts/BlogPost.astro"
title: "Idea: Temperature Threshold Alerting for Your Outdoor Plants"
description: "Planning another Side Project I Probably Won’t Do"
publishDate: "06 Sep 2022"
pubDate: "06 Sep 2022"
heroImage:
  src: "/assets/blog/002-temperature-threshold-alerting/frozen-plant.png"
  alt: "A plant in a pot"
---

First installment in the _Planning another New Side Project I Probably Won’t Do_ series.

While I don’t know if I’ll ever get around to building this, it’s a fun thought exercise for me to think about how I’d solve some of the problems I have in my daily living. Filing this away for a time when I can get to it, I’ll post an update if I ever get around to building it.

# 🧠 The Idea

I’ve got plants outside I want to keep growing. For example, freshly planted basil, tomatoes, peppes and other herbs.

<aside>
🌿 Depending on your climate, some plants can’t withstand the cold evening temperatures of spring. So you’ll want to bring them inside on nights getting colder than 45 or 35 degrees depending on the plant. Credit for the image below, [Washington Post](https://www.washingtonpost.com/lifestyle/2021/03/18/vegetable-planting-schedule-seeds-mid-atlantic/)

![Hardening Off](/assets/blog/002-temperature-threshold-alerting/hardening-off.png)

</aside>

I don’t know of an app that will alert you come 7PM local time that tonight’s temperature will go below some pre-specified amount, but I’ve probably killed almost a handful of early stage herbs (mostly basil) by not bringing them inside on colder nights here in Northern Virginia.

# ⚙️ Inner Workings

How this would probably work, at least in my mind:

1. A user would sign up, and provide their ZIP code, a specified temperature to be alerted for, a time of day they wish to receive their alerts, and a phone number or email so that we can contact them to let them know they need to take steps to protect their plants from the elements.
2. Once stored, we’d call a weather API to lookup the predicted low temperatures for the evening (or next 12 hour window perhaps, but that might be harder 🤷🏻‍♂️)

   We’d probably want to do a `unique` or `filter` function of some sort on our DB to only look up temperatures for a given ZIP code once, rather than duplicate calls to our weather API for users that might live in the same ZIP code

3. Once we collect temperatures for the evenings for each zip code, let’s iterate through our list of users, and if our collected temperature prediction is lower than their specified threshold, send them a text via Twilio to let them know that they should bring their plants inside (or something similar)
4. This could likely be run hourly and users could select at which hour they want to be alerted in their local time. We’d then only do this compute for users who want to be run at the currently desired hour

# 🏗️ Construction

We’d need a few pieces of infrastructure to get this working in an MVP form:

- A Weather API we can call on-demand or on a schedule
- A cron job mechanism for making calls daily to the third party weather API so that we can update our users when their ZIP code will get below their specified temp
- A method of alerting the users that they need to bring their plants in, likely an SMS sent via Twilio
- A database for storing user data - ZIP code for lookups, desired temperature threshold, phone number or email for sending them alerts. My guess is that this doesn’t really need more than 1 table at first, so a document/NoSQL DB (Dynamo, Mongo, Firebase, etc) is probably the way I’d try to start here
- Serverless function running the code to look up the predicted low temperat
- A REST API to allow users to change their ZIP code, phone number, alert time and temperature thresholds
  - An accompanying front end for users to send these updates to us, and to manage their accounts/payments if we chose to monetize it
  - Perhaps could be done with a WSYIWYG site generator, or something like React with a UI library or Tailwind. (This is the least interesting part to me, just a simple CRUD form basically)
- An initial sign up and payment page. This could **definitely** be done with some site generator like carrd and a simple serverless function on Netlify perhaps to insert this data into our DB of users and to take payment via Stripe

# 🏁 Wrapping Up and Follow-On Features

That’s basically it. I’m sure there’s some post-MVP features we could do such as:

- Multiple temperature thresholds for people with plants that can withstand a variety of temperatures
- Ability to look up when it might be **too hot** outside for plants, and that you should either water them additionally or bring inside if necessary. This could probably be added with a single `hot/cold` text enum stored on each entry in the DB (with perhaps more than 1 record per user, though this would likely make the API calls to display a user’s thresholds to them in a UI more expensive as you’d have to look up many records and aggregate them, but probably not prohibitively expensive)

🍻 So long, I’ll be sure to update this post if I ever get around to creating this. Maybe I’ll speed run it and see if I can do it in a single night or something
