# PERSONA TEST — Pipa Clara · Week 11 · Fátima Fortes Ortega

## 1. Who the synthetic user was

Run in a **fresh chat** (no project context). Prompt given:

> Eres **Doña Lupita**, 41 años, encargada de una vecindad de 5 hogares en Iztapalapa. Cuando el tandeo deja vacía la cisterna, tú pides la pipa, la recibes, pones el dinero y luego se lo cobras a los vecinos por WhatsApp. Usas un Android básico, WhatsApp todo el día, y desconfías de las apps nuevas: si algo te confunde, la cierras sin decir nada. Lees despacio. No quieres acusar al pipero (lo necesitas para la próxima vez) y no quieres pleitos con los vecinos.
>
> Tu tarea: registrar la pipa de hoy, ver si entró el agua que te cobraron y avisar al grupo cuánto le toca a cada quien. Habla en voz alta como Lupita: qué entiendes, qué no, dónde dudas, qué tocarías y en qué momento te rendirías. Al final, tus 3 confusiones más graves.

The persona comes from my Packet's exact user (the building's *encargada*), plus the two fears my Brain Bending and the Blueprint's shadow clause are about: **losing the pipero** and **fighting with neighbors**.

**Screens shown, in order:** welcome → settings → register the pipa → result ("Revisar") → split and share.

## 2. Where she got lost (full log)

| Screen | Confusion (her words, shortened) | Severity |
|---|---|---|
| Welcome | "SENSOR SIMULADO… ¿'simulado' no quiere decir que es de mentiras?" | Medium |
| Welcome | "Cuánta agua entró *de verdad*… o sea que piensan que el pipero me roba." | High |
| Welcome | The big button is the demo; the real one "parece apagado". | High |
| Welcome | "¿Los vecinos también tienen que bajar la app?" | Medium |
| Welcome | "Reparto" reads as the pipero delivering water, not splitting money. | Low |
| Settings | "Empezar con mi cisterna" sent her to Ajustes, not to register the pipa that is waiting outside. | High |
| Settings | Measurements came pre-filled (3 / 2.5 / 1.8): "¿Así es la mía? Si ya vienen puestos, pues los dejo." The math would silently use an invented cistern. | **Critical** |
| Settings | "Calibrar", "L por cm", "juicio", "valor de su hora", "costo del sensor $300" sound technical, legal or like a sale. | Medium |
| Settings | "Estos nombres nunca se comparten": then how does she tell the group what each one owes? | Medium |
| Settings | "Borrar todos mis datos" too close to other buttons. | Low |
| Result | "Revisar con Lupita", in third person on her own phone, reads as an accusation against her; "revisarlo con el pipero" is the confrontation she avoids. | **Critical** |
| Result | "ML" read as *mililitros*. "Observado" vs "Estimado": which one counts? | Medium |
| Result | "Los vecinos usaron aprox. 99 L" creates a culprit among neighbors. | High |
| Result | Below the result, the form showed 10,000 / $1,800 / "Entrega completa" again, so she thought her data was lost and that the app ignored her choice. | High |
| Result | "Pipas anteriores" keeps a permanent "Revisar" label. | Medium |
| Split | The WhatsApp summary sent **the missing liters, "Revisar con Lupita" and "2 de 5 aportaciones"** to the whole group, which includes the pipero's sister-in-law. | **Critical** |
| Split | Two amounts per household ($360 split vs $369 "costo real"). | High |
| Split | WhatsApp button looked disabled, with no explanation. | Medium |

**Her verdict:** "Cierro la app, abro WhatsApp y escribo yo misma: 'Vecinos, ya llegó la pipa, salió en $1,650, tocan $330 cada quien. Gracias 🙏'. La app no la vuelvo a abrir."

**Her top 3:** (1) the app shows data she didn't enter and the money comes out wrong; (2) the app accuses, and the WhatsApp summary spreads the accusation; (3) she never knows what is real and what is the example.

### What I discounted, honestly
- The persona said she had changed the price to $1,650; the screenshots show $1,800. She invented that action, but the confusion behind it is real: the form under the result showed default values, so it *looked* like her data was gone.
- The "already paid" statuses were set by me when taking the screenshot, not by the app. Still, it shows the app doesn't make clear what is the user's and what is an example.
- She read the result as contradicting "Entrega completa", but the screenshot had "Entrega corta" selected. The cause was the same form reset, so I treated it as the same root problem, not as a sensor bug.

## 3. The worst one, and what I fixed

**Worst confusion: the shared summary broadcast the accusation.** It's the only one that does harm *outside* the phone, and it breaks Blueprint **Condition 1** (only an approved *order summary* reaches the group) and the **Shadow Clause** (no public exposure). A persona that quits is a lost user; a persona that sends that message is a fight in the vecindad and a pipero who stops coming.

**Fix (deployed):**
- The WhatsApp message now carries **only the cost by default**: *"💧 Ya llegó la pipa (22 oct 2026). Costó $1,650 entre 5 hogares: toca $330 por hogar. Gracias 🙏"*, which is almost word for word what Lupita said she would write herself.
- Liters and "cuántos ya pagaron" are **opt-in checkboxes**, both off by default. Changing an option un-checks "Ya leí el mensaje", so a changed message must be read again before sending.
- A hint under the WhatsApp button explains why it's inactive.

**Also fixed in the same deploy (cheap, high-severity items):**
- Verdict title changed from "Revisar con Lupita" to **"Diferencia por revisar"**, with *"Esto solo lo ves tú. Quién lo revisa: Lupita, si y cuando le parezca."* (Condition 4 still names a person, without pointing at her.)
- "Los vecinos usaron 99 L" became "agua usada en el edificio durante la descarga (estimada)", and the technical detail moved into a collapsed "¿Cómo se calculó?".
- **No more invented cistern:** "Registrar mi pipa" is now the main button and goes straight to registering. Measurements start empty; until they are entered, the app shows "—" for liters and says *Datos insuficientes*, while the cost split works.
- The result card shows **"Pagaste $1,650"**; the "Registrar otra pipa" form is collapsed and keeps her last values, so nothing looks erased.
- Tab "Reparto" became "2 · Cobrar"; "juicio", "calibrar" and "valor de su hora" were reworded; sensor and cost settings moved under "Opciones avanzadas"; "costo real" is collapsed and labeled "solo para ti, no se cobra"; "Borrar todos mis datos" has more space around it; the welcome screen says neighbors don't need to install anything.

**Verified after the fix:** 20/20 unit tests (two new: default summary has no liters, verdict, count or names; liters/count only when opted in), browser walk-through at 390 px with no errors and no horizontal scroll.

## 4. Not fixed (logged for next week)
- "SENSOR SIMULADO" still worries a first-time user. It has to stay (Blueprint Condition 6 requires the label); the real answer is a real sensor.
- The demo-scenario picker ("Solo para la demostración") is inherently strange for a real user; it disappears with real hardware.
- A real household voice is still missing: this was a synthetic user. Next step: show the live URL to one real encargada (the Blueprint gives this to the User role).
