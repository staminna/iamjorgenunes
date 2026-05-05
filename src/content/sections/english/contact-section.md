---
enable: true
title: "Got a project on your mind?"
description: "Looking for help shipping an agentic platform, RAG pipeline or full-stack product? Send a message and I'll get back to you."

map:
  enable: false
  position: "right"
  title: ""
  url: ""

contactInformation:
  - title: "Location"
    icon: "/images/icons/svg/location-filled.svg"
    description: "Pombal, Portugal — remote across EU & global timezones"
    button:
      enable: false
      label: ""
      url: ""

  - title: "Email"
    icon: "/images/icons/svg/message-filled.svg"
    description: |
      stamina.nunes@gmail.com
    button:
      enable: true
      label: "Send Email"
      url: "mailto:stamina.nunes@gmail.com"

  - title: "Phone"
    icon: "/images/icons/svg/phone-filled.svg"
    description: |
      +351 914 764 120
    button:
      enable: true
      label: "Call Anytime"
      url: "tel:+351914764120"

form:
  emailSubject: "New message from iamjorgenunes.com"
  submitButton:
    enable: true
    label: "SEND MESSAGE"

  inputs:
    - label: ""
      placeholder: "Full Name *"
      name: "Full Name"
      required: true
      halfWidth: true
      defaultValue: ""
    - label: ""
      placeholder: "Email Address *"
      name: "Email Address"
      required: true
      type: "email"
      halfWidth: true
      defaultValue: ""
    - label: ""
      placeholder: "Subject *"
      name: "Subject"
      required: false
      halfWidth: false
      dropdown:
        type: ""
        items:
          - label: "Agentic AI / LLM project"
            value: "Agentic AI / LLM project"
            selected: false
          - label: "Full-stack engineering"
            value: "Full-stack engineering"
            selected: false
          - label: "DevOps / Kubernetes / IaC"
            value: "DevOps / Kubernetes / IaC"
            selected: false
          - label: "Consulting / advisory"
            value: "Consulting / advisory"
            selected: false
          - label: "Other"
            value: "Other"
            selected: false
    - label: ""
      tag: "textarea"
      defaultValue: ""
      rows: "4"
      placeholder: "Tell me about your project *"
      name: "Message"
      required: true
      halfWidth: false
    - label: "I agree to be contacted about this enquiry."
      id: "privacy-policy"
      name: "Agreed Privacy"
      value: "Agreed"
      checked: false
      required: true
      type: "checkbox"
      halfWidth: false
      defaultValue: ""
    - note: success
      parentClass: "hidden text-sm message success"
      content: Thanks for reaching out — I'll reply shortly.
    - note: deprecated
      parentClass: "hidden text-sm message error"
      content: Something went wrong. You can also email me directly at [stamina.nunes@gmail.com](mailto:stamina.nunes@gmail.com).
---
