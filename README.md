
![image](readme-header.png)
**A minimalist framework for building prototypes that scale using articulating components**

<sub>* *Hin.JS* comes from a [lineage of experimental frameworks](#lineage) inspired by F# and is pure vanilla JavaScript!

## Just 4 methods that give you: 
- **Type Safety** without the TypeScript Tax
- **Dependency Injection** without the hassle
- **Reactive state management** that is safe and traceable
- **Additive inheritance** that avoids the fragile base class problem

*Hin.JS* constrains JavaScript so that it's natural to write [SOLID](https://en.wikipedia.org/wiki/SOLID) code that avoids the common pitfalls and is easy to grow & refactor. **It's the wisdom of my 20 years of experience condensed into a simple framework**.

## Hin.JS vs Classes
| **Concept**                | **JavaScript Class**                                           | **Hin.JS Group**                                                                          |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Definition**             | `class Person { constructor() { this.name = "Alice" } }`       | `const Person = group({ name: hinj("Alice") })`                                           |
| **Instantiation**          | `const p = new Person()`                                       | `const p = Person()`                                                                      |
| **Get / set values**       | `p.name = "Bob"` and `console.log(p.name)`                     | `await Person.name(p, "Bob")` and `console.log(Person.name(p))`                                        |
| **Internal state**         | Stored as mutable fields on the instance (`this`)              | Stored under hidden Symbols, only accessed via property functions                         |
| **Side effects on change** | Must be implemented manually with setters or Proxies           | Use `.sync()` and `.async()` for traceable, layered side effects                          |
| **Default / lazy values**  | Set in constructor or assigned later                           | Use `hinj("value")` for static, or `hinj((T) => ...)` for lazy-on-access defaults         |
| **Dependency injection**   | Manual wiring or external libraries (e.g., Inversify)          | Built-in: access shared context through parent groups automatically                       |
| **Method definition**      | Class methods or arrow functions, `this`-bound                 | Define stateless `$methods` using `hinj().async(...)`                                     |
| **Extensibility**          | Inherit with `extends`, often deep and fragile                 | Use `group({ ...Base, newProp })`; extend property behavior explicitly via `.sync(hinjA)` |
| **Type safety**            | Optional via TypeScript, often requires additional boilerplate | Getters/Setters are always typed, eg. `Person.name(p)`         |

<br>

# 🧩 Key Concepts
### `group({...})` Creates a factory that builds a stateful instance.
All properties are defined using `hinj()`.
```js
const MyGroup = group({
  prop: hinj("default")
})
```
- Instantiating: `const g = MyGroup()`
- Accessing property: `MyGroup.prop(g)`
- Setting property: `MyGroup.prop(g, "newValue")`

All state is stored internally using Symbols — instance objects (`g`) do not expose properties directly.

### `hinj([default])` Creates a property function.
This function has 2 modes
```js
// Getter mode
MyGroup.property(instance) // → current value
// Setter mode
MyGroup.property(instance, newValue)
```
Supports:
- Static defaults: hinj("value")
- Lazy defaults: hinj((T) => computeSomething(T))
 
⚠️ Avoid nesting functions like hinj(() => (T) => ...) — only use hinj((T) => ...).

### 🔁 Reactive Layers
#### `.sync(fn)`

```js
count: hinj().sync((T, value) => console.log("Updated:", value))
```

- Called every time a value is set.
- Runs immediately and does not wait on Promises.
- Has 0 or 1 parameters (`value` in the above example). Mimic multiple parameters by passing an object.
- Best for logging, side effects, event dispatching

⚠️ The return value of the layer `fn` defined as `.sync(fn)` is ignored.

#### `.async(fn)`
```js
count: hinj().async(async (T, value) => {
  await sendToServer(value)
})
```
- Called every time a value is set. 
- Awaits on the Promise returned by `fn` before moving onto the next layer, whether the next layer is `sync` or `async`
- Has 0 or 1 parameters (`value` in the above example). Mimic multiple parameters by passing an object.
- Best for: async validation, saving to a database, calling APIs

⚠️ The returned Promise is awaited, but its resolved value is discarded.


## Basic Example

```js
import {hinj, group} from 'hin.js'

const Database = group({
  connectionUrl: hinj(process.env.CONNECTION_URL),
  sql: hinj(
      /* setting lazy, default value */ 
      T => {
        const url = Database.connectUrl(T)
        // if using postgres library
        return postgres(url)
  }),
})

const Server = group({
  $handleIndex: hinj()
      .async(await (T, {req, res}) => {
        const i = Index(T) // creating a new instance of Index
                           // and setting this instnace of Server as the parent
        await Index.$load(i)
  
        const list = Index.list(i)
        const html = list.length ? 
            `<ul>${list.map(r => `<li>${r}</li>`)}</ul>` 
            : '<b>Nothing found!</b>'
        res.end(html)
      })
})

const Index = group({
  list: hinj(),
  $load: hinj()
      .async(await T => {
        const sql = Database.sql(T) // dependency injection at work
        const list = await sql`SELECT path FROM files`
        Index.list(T, list.map(r => r.path))
      })
})

// Initializing
const db = Database()
const server = Server(db) // Database becomes the parent of Server
                          // Now all hinj functions in `server` instance have access to `db` through dependency injection

// Running
Server.$handleIndex(server, {req, res /* provided by Express.js */})
```

<br>

# In-depth 
## Stateful Properties vs Stateless Methods
### 💎 Stateful Properties

These are the most common kind: **they store a value internally** (under a Symbol).

When a setter is executed (or a getter is called and a default value is set) they follow this execution order:

> Default (if unset) → `sync` and `async` layers in the order that they are defined.  

Default values are evaluated first. Then sync() and async() layers run as a result of setting the value. If a getter is called when no value is set, and the default value is used, all the layers are executed before the (default) value is returned. **The most recently set value is cached and returned on read**.

```js
import { group, hinj } from "hin.js"

const State = group({
  value: hinj("initial")
    .sync((T, v) => {
      console.log("Layer 1 (sync):", v)
    })
    .async(async (T, v) => {
      await new Promise(res => setTimeout(res, 100))
      console.log("Layer 2 (async):", v)
    })
    .sync((T, v) => {
      console.log("Layer 3 (sync):", v)
    })
})

// Instantiation
const s = State()

// Getter triggers default + layer stack
console.log("Getter output:", State.value(s))

// Now explicitly set a new value
await State.value(s, "hello")

/*
Expected Output:

Layer 1 (sync): initial
Layer 2 (async): initial
Layer 3 (sync): initial
Getter output: initial
Layer 1 (sync): hello
Layer 2 (async): hello
Layer 3 (sync): hello
*/
```

### ⚡ Stateless Methods

These **do not** store values — they are often used for methods or triggers. A method must have its name (key in the object passed to `group()`) start with `$`.

They run in the reverse order:
> sync() / async() layers → Default/Return value (if any)

This reversal is subtle yet important when the default is a function.

The default is used as a **return value**, not as the initial value to store. This means you can model "pure functions" using stateless hinj — like `() => result`.

```js
import { group, hinj } from "hin.js"

// External dependency: Currency conversion group
const CurrencyAPI = group({
  rate: hinj(1.3), // default fallback rate

  $fetchRate: hinj().async(async (T, { from, to }) => {
    try {
      const res = await fetch(`https://api.exchangerate.host/convert?from=${from}&to=${to}`)
      const data = await res.json()
      CurrencyAPI.rate(T, data.info.rate)
    } catch {
      console.warn("Failed to fetch rate, using default")
    }
  })
})

// Main business group: Invoice
const Invoice = group({
  lineItems: hinj(() => [
    { amount: 100, tax: 15, discount: 10 },
    { amount: 200, tax: 30, discount: 0 },
  ]),

  currency: hinj("USD"),

  $convertInvoiceTotals: hinj((T, { from, to }) => {
    const items = Invoice.lineItems(T)
    const rate = CurrencyAPI.rate(T)

    const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
    const tax = items.reduce((sum, i) => sum + i.tax, 0)
    const discount = items.reduce((sum, i) => sum + i.discount, 0)
    const total = (subtotal + tax - discount) * rate

    return {
      currency: to,
      subtotal: subtotal * rate,
      tax: tax * rate,
      discount: discount * rate,
      total
    }
  })
    .sync((T, { from, to }) => {
      console.log(`Generating summary from ${from} to ${to}`)
    })
    .async(async (T, { from, to }) => {
      await CurrencyAPI.$fetchRate(T, { from, to })
    })
})

const c = CurrencyAPI()
const inv = Invoice(c)

const result = await Invoice.$convertInvoiceTotals(inv, {
  from: "CAD",
  to: "USD"
})

console.log("Summary:", result)

/*
Expected Output:
Generating summary from CAD to USD
Summary: {
  currency: 'USD',
  subtotal: 390,
  tax: 58.5,
  discount: 13,
  total: 435.5
}
*/


```

### ⚠️ Why This Matters

If your default is a function that should produce input to the rest of the chain (e.g., computed state), use a stateful property.

If your default is meant to be the final output (like a return value), use a stateless method.

| Feature          | **Stateful**                  | **Stateless**             |
| ---------------- | ----------------------------- | ------------------------- |
| Stores a value?  | ✅ Yes                         | ❌ No                      |
| Used for…        | Reactive state, configuration | Actions, computed values  |
| Execution order  | `default → sync / async`      | `sync / async → default/return value`  |
| Memoized output? | ✅ Yes              | ❌ No                      |
| Access pattern   | `Group.prop(T)`               | `Group.$method(T, [input])` |
| Closest analogy  | State variable                | Pure function / method    |

## 🧬 Inheritance in Hin.JS

Hin.JS allows **additive inheritance** of both properties and behavior via plain object spread (`...`). Unlike class-based inheritance which risks the fragile base class problem, Hin.JS encourages explicit, modular, and composable design. **Overrides are not allowed** for the exception of the default/return value, thus every layer defined in the base `hinj` is executed when extended.

You can inherit:

- Property definitions from another group
- Behavior layers of a specific property using `.sync()` and `.async()` chained on parent `hinj`

### Property Inheritance via `group`

This merges all properties from a base group into a new group. You can also pick out individual properties – there is no magic, just plain JS. 

```js
const Base = group({
  name: hinj("Anonymous"),
  age: hinj(0),
})

const Extended = group({
  ...Base,
  city: hinj("Halifax")
})

const p = Extended()
console.log(Extended.name(p)) // "Anonymous"
console.log(Extended.city(p)) // "Halifax"
```

### Behavior Inheritance via Chaining

Use `.sync(hinjX)` or `.async(hinjX)` to extend behavior from an existing `hinj` definition. This allows you to build on previously defined reactive logic.

```js
const logName = hinj()
  .sync((T, value) => console.log("Base name set to:", value))

const Base = group({
  name: logName
})

const Extended = group({
  name: hinj()
    .sync(Base.name) // carry over base behavior
    // you could also use .sync(logName) for the same effect
    .sync((T, value) => console.log("Extended name logic:", value))
})

const p = Extended()
Extended.name(p, "Alice")

// Console:
// Base name set to: Alice
// Extended name logic: Alice
```

### Overriding Default Values

You can override a default when extending a group by simply redefining the hinj() with a new default (don't forget to tag the base `hinj` in a `sync` or `async` layer):

```js
const Person = group({
  name: hinj("Anonymous"),
})

const Admin = group({
  ...Person,
  name: hinj("Superuser") // overrides default
        .sync(Person.name) // lets Hin.JS know that you're extending Person.name
        // calling .async(Person.name) has the same effect regarding inheritance. Regular sync vs async promise resolution behaviour applies.
})

const p = Admin()
console.log(Admin.name(p)) // "Superuser"
console.log(Person.name(p)) // "Superuser"

```

### ⚠️ Common pitfall!
Failing to declare that `Admin.name` extends `Person.name` with a `sync` or `async` call will result with broken inheritance.

```js
const Person = group({
  name: hinj("Anonymous"),
})

const Admin = group({
  ...Person,
  name: hinj("Superuser")
        // oops! We forgot to be explicit with inheritance
        // .sync(Person.name)
})

const p = Admin()
// This still works
console.log(Admin.name(p)) // "Superuser"
// This will error
console.log(Person.name(p)) // Error!
```

### Example: CRM Contact Groups
```js
const Contact = group({
  name: hinj("Unnamed")
    .sync((T, value) => console.log("Contact named:", value)),

  email: hinj(),
  phone: hinj(),
})
const TaggedContact = group({
  ...Contact,

  tags: hinj(() => []),

  addTag: hinj().sync((T, tag) => {
    const tags = TaggedContact.tags(T)
    if (!tags.includes(tag)) {
      TaggedContact.tags(T, [...tags, tag])
    }
  })
})
const SalesContact = group({
  ...TaggedContact,

  // Override default value
  name: hinj("Sales Prospect")
    .sync(Contact.name) // extend behavior
    .sync((T, value) => {
      if (value.includes("VIP")) {
        console.log("High-priority contact!")
      }
    }),

  leadScore: hinj(0),

  $registerActivity: hinj()
    .sync((T, { type }) => {
      if (type === "meeting") {
        const current = SalesContact.leadScore(T)
        SalesContact.leadScore(T, current + 10)
      }
    })
})

const c = SalesContact()

SalesContact.name(c, "VIP - Bobby Client") // logs "High-priority contact!"
SalesContact.addTag(c, "hot-lead")
SalesContact.$registerActivity(c, { type: "meeting" })

console.log(SalesContact.tags(c)) // ["hot-lead"]
console.log(SalesContact.leadScore(c)) // 10
```

## 🧭 Parent/Child Tracing & Dependency Injection

Hin.JS supports automatic dependency injection using a parent chain. When you instantiate a group, you can optionally pass a parent instance. This enables:

- Access to properties defined in ancestor groups
- Layered composition without needing explicit wiring
- Introspectable control over data flow

This is the core feature that enables Hin.JS to build modular, traceable apps — without global state or brittle context.

### 🔗 How It Works

Every group instance (`T`) can carry a parent. When you call `Group.prop(T)`, Hin.JS will:

1. Look for the value inside `T`
2. If not found, walk up the parent chain
3. Resolve the first available value from any ancestor

This is true for:

- Getting properties: `Group.prop(T)`
- Running layers: all `.sync()` and `.async()` layers receive the full context tree
- Computed defaults: `hinj((T) => ...)` can pull values from parent(s)

### Example
```js
const Config = group({
  timezone: hinj("UTC"),
})

const Logger = group({
  $log: hinj().sync((T, msg) => {
    const tz = Config.timezone(T)
    console.log(`[${tz}]`, msg)
  })
})

const Service = group({
  logger: hinj(T => Logger(T))
  $run: hinj().sync((T) => {
    Logger.$log(Service.logger(T), "Service started")
  })
})

// Create parent instance
const config = Config()

// Child instance inherits access to config
const service = Service(config)

Service.$run(service)
// → [UTC] Service started
```

## Work in Progress Sections 
### Public dependencies
### Private dependencies
### Singletons
### Mocking dependencies

<br>

# Notes
### <a hame="lineage"></a>Lineage:
- [Layer-compose](https://github.com/GoHarbr/layer-compose): the grandmother of the Hin.JS which tried to do too much
- [Filo](https://github.com/GoHarbr/filo): that one that almost got it right (still used in production by [Harbr](https://harbr.com/))
- Hin.JS: is the stripped down version of Filo that gives granular control while giving better coding ergonomics and much, much improved performance

### Stability:
hin.<i>js</i> is a stable set of 
procedures, commands and library interface.
It satisfies the target feature set already,
the interface has no planned changes. There are planned utilities for unit testing. 


There might be a few ergonomic improvements introduced
on the way to 2.0.0 (which will take a long time). Those
would be inconsequential and backwards compatible.

The additional functionality (because who doesn't like
to have it their way?) will come as plugins.  

