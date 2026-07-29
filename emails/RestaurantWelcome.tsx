import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Text,
} from "@react-email/components";

type RestaurantWelcomeProps = {
	restaurantName: string;
	dashboardUrl: string;
};

export function RestaurantWelcome({
	restaurantName,
	dashboardUrl,
}: RestaurantWelcomeProps) {
	return (
		<Html>
			<Head />
			<Preview>Your AwaMenu dashboard is ready.</Preview>
			<Body
				style={{
					backgroundColor: "#fafafa",
					color: "#18181b",
					fontFamily: "Arial, sans-serif",
				}}
			>
				<Container
					style={{ margin: "0 auto", padding: "32px 20px", maxWidth: "560px" }}
				>
					<Heading>Welcome to AwaMenu</Heading>
					<Text>
						{restaurantName} is ready. You can now manage your restaurant from
						your dashboard.
					</Text>
					<Button
						href={dashboardUrl}
						style={{
							backgroundColor: "#18181b",
							color: "#ffffff",
							padding: "12px 18px",
						}}
					>
						Open dashboard
					</Button>
				</Container>
			</Body>
		</Html>
	);
}
